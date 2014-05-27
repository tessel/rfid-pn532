// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// datasheet: http://www.nxp.com/documents/short_data_sheet/PN532_C1_SDS.pdf
// user manual: http://www.nxp.com/documents/user_manual/141520.pdf

//  todo: finish read mem, start anyting related to changing mem contents

var DEBUG = 0; // 1 if debugging, 0 if not

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var PN532_COMMAND_INLISTPASSIVETARGET = 0x4A;
var PN532_COMMAND_GETFIRMWAREVERSION = 0x02;
var PN532_COMMAND_SAMCONFIGURATION = 0x14;
var PN532_I2C_READY = 0x01;
var PN532_PREAMBLE = 0x00;
var PN532_STARTCODE1 = 0x00;              // jshint ignore:line
var PN532_STARTCODE2 = 0xFF;
var PN532_POSTAMBLE = 0x00;
var PN532_I2C_ADDRESS = 0x48 >> 1;
var PN532_I2C_READBIT = 0x01;             // jshint ignore:line
var PN532_I2C_BUSY = 0x00;
var PN532_I2C_READY = 0x01;
var PN532_I2C_READYTIMEOUT = 20;          // jshint ignore:line
var PN532_HOSTTOPN532 = 0xD4;
var PN532_MIFARE_ISO14443A = 0x00;
var WAKE_UP_TIME = 100;
var PN532_COMMAND_INDATAEXCHANGE = 0x40;  // jshint ignore:line
var MIFARE_CMD_AUTH_A = 0x60;             // jshint ignore:line
var MIFARE_CMD_AUTH_B = 0x61;             // jshint ignore:line

function RFID (hardware, callback) {
  var self = this;

  self.hardware = hardware;
  self.irq = hardware.digital[3];

  self.irqcallback = function () {
    self.emit('irq', null, 0);
  };

  self.irq.watch('fall', self.irqcallback);
  self.nRST = hardware.digital[2];

  self.nRST.output();
  self.nRST.low(); // Toggle reset every time we initialize

  self.i2c = new hardware.I2C(PN532_I2C_ADDRESS);
  self.i2c._initialize();

  self.listeningLoop = null;
  self.pollPeriod = 200;

  setTimeout(function () {
    self.nRST.high();
    self._getFirmwareVersion(function (err, version) {
      if (!version) {
        self.emit('error', err);
        if (callback) {
          callback(err);
        }
      } else {
        self.emit('ready');
      }
    });
  }, WAKE_UP_TIME);

  // If we get a new listener
  self.on('newListener', function (event) {
    if (event == 'data' || event == 'read') {
      // Add to the number of things listening
      if (EventEmitter.listenerCount(event) === 0) {
        // Start listening
        self._startListening();
      }
    }
  });

  // If we remove a listener
  self.on('removeListener', function (event) {
    if (event == 'data' || event == 'read') {
      if (EventEmitter.listenerCount(event) === 0) {
        self._stopListening();
      }
    }
  });
}

util.inherits(RFID, EventEmitter);

RFID.prototype._checkAck = function (packet) {
  /*
  Verify that the packet is an ack packet.
  */
  var successfulAck = [0x1, 0x0, 0x0, 0xff, 0x0, 0xff]; // index 0 depends on direction of transfer

  return successfulAck.reduce(function(prev, curr, i, arr){ return prev && (curr === packet[i]) });
};

RFID.prototype._checkPacket = function (packet) {
  /*
  Verify that the packet has a valid checksum or is an ack packet. Assumes the structure:

  0         Direction of transfer (0 or 1)
  1         preamble                0x00
  2         SOP header              0x00
  3                                 0xFF
  4         Length
  5         Length checksum
  ...
  Length+5  Data checksum
  */

  if ((packet[1] === 0 && packet[2] === 0 && packet[3] === 0xff) && (packet[4] + packet[5]) % 256 === 0 ) {
    //  option 2: the packet is valid via headers, cheksum
    //  passes start of packet and length checksum
    var dl = packet[4];
    var check = 0;
    for (i = 6; i <= dl + 6; i++) {
      if (packet[i] !== undefined) {
        check += packet[i];
      } else {
        return false; //  fails data schecksum
      }
    }
    if (DEBUG) {
      console.log('checksum...sum', check, check%256);
    }
    if (check % 256 === 0) {
      return true;  //  passes data checksum test
    }
  }
  return false;
};

RFID.prototype._getFirmwareVersion = function (callback) {
  /*
  Ask the PN532 chip for its firmware version

  Args
    callback
      Callback function; gets err, reply as args
  */
  var self = this;
  var response;

  if (DEBUG) {
    console.log('Starting firmware check...');
  }

  var commandBuffer = [PN532_COMMAND_GETFIRMWAREVERSION];

  if (DEBUG) {
    console.log('Beginning sendCommandCheckAck in _getFirmwareVersion...');
  }
  self._sendCommandCheckAck(commandBuffer, function (err, ack) {
    if (DEBUG) {
      console.log('sendCommandCheckAck complete. err ack:', err, ack);
    }
    if (!ack) {
      callback(new Error('no ack'), null);
    }
    else {
      if (DEBUG) {
        console.log('Reading wire data in _getFirmwareVersion');
      }
      self._wireReadData(12, function (err, firmware) {
        if (DEBUG) {
          console.log('FIRMWARE: ', firmware);
          console.log('cleaned firmware: ', response);
        }
        self._SAMConfig(callback);
      });
    }
  });
};

RFID.prototype._getUID = function (cardBaudRate, callback) {
  /*
  Passes the UID of the next ISO14443A target that is read to the callback

  Args
    cardBaudRate
      Baud rate of RF communication with card. When in doubt, use 0.
    callback
      Callback function; gets err, reply as args
  */
  var self = this;
  self._read(cardBaudRate, function (err, card) {
    if (card && callback) {
      callback(err, card.uid || null);
    }
  });
};

RFID.prototype._initialize = function (hardware, callback) {
  var self = this;

  self._getFirmwareVersion(function (err, firmware) {
    if (err) {
      self.emit('error', err);
      if (callback) {
        callback(err);
      }
    }
    if (callback) {
      callback(null, firmware);
    }
  });
  // TODO: Do something with the bank to determine the IRQ and RESET lines
};

RFID.prototype._read = function (cardBaudRate, callback) {
  /*
  Read the contents of the card, call the callback with the resulting Buffer

  Args
    cardBaudRate
      Baud rate used for communication with the card
    callback
      Callback function; args: err, data

  TODO: use IRQ interrupt instead of polling
  */
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_INLISTPASSIVETARGET,
    1,
    cardBaudRate
  ];

  self._sendCommandCheckAck(commandBuffer, function (err, ack) {
    if (err || !ack) {
      if (callback) {
        callback(err, ack);
      }
    } else {
      // Wait for a card to enter the field
      var parseCard = function (err, res) {
        /* ISO14443A card response should be in the following format:

          byte            Description
          -------------   ------------------------------------------
          b0..6           Frame header and preamble
          b7              Tags Found
          b8              Tag Number (only one used in this example)
          b9..10          SENS_RES
          b11             SEL_RES
          b12             NFCID Length
          b13..NFCIDLen   NFCID                                      */

        var Card = {};
        res = res.slice(1); // cut off the read/write direction bit
        Card.header = res.slice(0, 7);                // Frame header & preamble
        Card.numTags = res[7];                        // Tags found
        Card.tagNum = res[8];                         // Tag number
        Card.SENS_RES = res.slice(9, 11);             // SENS_RES
        Card.SEL_RES = res[11];                       // SEL_RES
        Card.idLength = res[12];                      // NFCID Length
        Card.uid = res.slice(13, 13 + Card.idLength); // NFCID

        if (DEBUG) {
          console.log('Parsed card:\n', Card);
        }
        if (callback) {
          callback(err, Card);
        }
      };
      var waitLoop = setInterval(function () {
        if (self._wireReadStatus() === PN532_I2C_READY) {
          clearInterval(waitLoop);
          // read data packet
          var dataLength = 20;
          self._wireReadData(dataLength, function (err, res) {
            if (!err && self._checkPacket(res)) {
              parseCard(err, res);
            } else {
              if (callback) {
                callback(err || new Error('invalid packet'), res);
              }
            }
          });
        }
      }, self.pollPeriod);
    }
  });
};

RFID.prototype._readAckFrame = function (callback) {
  // Read in what is hopefully a positive acknowledge from the PN532
  this._wireReadData(6, callback);
};

RFID.prototype._readRegisters = function (dataToWrite, bytesToRead, callback) {
  /*
  Read and write data from/to the PN532's I2C buffer

  Args
    dataToWrite
      What to write to the buffer
    bytesToRead
      How many reply bytes to read back
    callback
        Callback function; gets err, reply as args
  */
  var self = this;

  if (DEBUG) {
    var s = '[';
    for (i = 0; i < dataToWrite.length; i++) {
      s += dataToWrite[i].toString(16) + ', ';
    }
    s = s.slice(0, s.length-2) + ']';
    console.log('\n\ttrying to read by sending:\n\t', s);
  }
  self.i2c.transfer(new Buffer(dataToWrite), bytesToRead, function (err, data) {
    if (DEBUG) {
      var s = '[';
      for (var i = 0; i < data.length; i++) {
        s += '0x'+data[i].toString(16) + ', ';
      }
      s = s.slice(0, s.length-2) + ']';
      console.log('\treply:\n\t', err, '\n\t', s, '\n');
    }
    if (callback && (self._checkAck(data) || self._checkPacket(data))) {
      if (DEBUG) {
        console.log('packet verified:\n', data);
      }
      callback(err, data);
    }
    else {
      if (DEBUG) {
        console.log('invalid packet:\n', data);
      }
      if (callback) {
        callback(new Error('packet improperly formed'), data);
      }
    }
  });
};

RFID.prototype._SAMConfig = function (callback) {
  //  Configure the Secure Access Module
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_SAMCONFIGURATION,
    0x01,
    0x14,
    0x01
  ];

  self._sendCommandCheckAck(commandBuffer, function (err, ack) {
    if (!ack || err) {
      if (DEBUG) {
        console.log('failed to SAMConfig');
      }
      callback(err, false);
    }
    // Read data packet
    else {
      self._wireReadData(8, function (err, response) {
        if (DEBUG) {
          console.log('SAMConfig response:\n', err, '\n', response);
        }
        callback(err, response);
      });
    }
  });
};

RFID.prototype._sendCommandCheckAck = function (cmd, callback) {
  /*
  Send a command, check that the module acknowledges

  Args
    cmd
      Command to send
    callback
      Callback function; gets err, reply as args
  */
  var self = this;
  self._wireSendCommand(cmd, function (err, data) {
    if (DEBUG) {
      console.log('kickback from readreg:\n', err, '\n', data);
    }
    if (err) {
      self.emit('error', new Error('Error reading register.'));
    }
  });

  self.irq.once('fall', function (err1, data) {
    if (err1 && callback) {
      callback(err1, data);
    }
    self._readAckFrame(function (err2, ackbuff) {
      if (err2 && callback) {
        callback(err2, null);
      } else if (callback) {
        callback((!ackbuff || !self._checkAck(ackbuff)) ? new Error('ackbuff was invalid') : null, ackbuff);
      }
    });
  });
};

RFID.prototype._startListening = function (callback) {
  //  Configure the module to automatically emit UIDs
  var self = this;
  // Loop until nothing is listening
  self.listeningLoop = setInterval(self._attemptCardRead.bind(self) ,self.pollPeriod);

  if (callback) {
    callback();
  }
};

RFID.prototype._attemptCardRead = function() {
  var self = this;
  self._getUID(PN532_MIFARE_ISO14443A, function (err, uid) {
    if (!err && uid && uid.length) {
      self.emit('data', uid.toString('hex')); // streams1-like event
      self.emit('read', uid.toString('hex')); // explicit read event
    } else if (callback) {
      if (err) {
        self.emit('error', err);
        callback(err);
        return;
      }
      err = new Error('No UID');
      self.emit('error', err);
      callback(err);
      return;
    }
  });
}

RFID.prototype._stopListening = function (callback) {
  var self = this;
  clearInterval(self.listeningLoop);
  self.listeningLoop = null;
  if (callback) {
    callback();
  }
};

RFID.prototype._wireReadData = function (numBytes, callback) {
  /*
  Read in numBytes of data (0-63) from the PN532's I2C buffer

  Args
    numBytes
      Number of bytes to read (0-63)
    callback
      Callback function; gets err, reply as args
  */
  var b = new Buffer(0);
  this._readRegisters(b, numBytes + 2, function (err, reply) {
    if (callback) {
      callback(err, reply);
    }
  });
};

RFID.prototype._wireReadStatus = function () {
  //  Check the status of the IRQ pin
  var x = this.irq.read();
  if (x === 1) {
    return PN532_I2C_BUSY;
  }
  else {
    return PN532_I2C_READY;
  }
};

RFID.prototype._wireSendCommand = function (cmd, callback) {
  /*
  Add the proper header, footer, checksums, etc. and send the command

  Args
    cmd
      Command to send
    callback
      Callback function; gets err, reply as args
  */
  var checksum;
  var self = this;
  var cmdlen = cmd.length+1;

  checksum = -1;

  var sendCommand = [PN532_PREAMBLE,
    PN532_PREAMBLE,
    PN532_STARTCODE2,
    cmdlen,
    (255 - cmdlen) + 1,
    PN532_HOSTTOPN532];

  checksum += PN532_HOSTTOPN532;

  for (var i = 0; i < cmdlen - 1; i++) {
    sendCommand.push(cmd[i]);
    if(cmd[i]) {
      checksum += cmd[i];
    }
  }
  checksum = checksum % 256;
  sendCommand.push((255 - checksum));
  sendCommand.push(PN532_POSTAMBLE);
  self._writeRegister(sendCommand, callback);
};

RFID.prototype._writeRegister = function (dataToWrite, callback) {
  /*
  Write data to the PN532's I2C register

  Args
    dataToWrite
      Data to write to buffer
    callback
      Callback function; gets err, reply as args
  */

  if (DEBUG) {
    console.log('\n\twriting buffer:\n\t', dataToWrite, '\n');
  }

  this.i2c.send(new Buffer(dataToWrite), callback);
};

// Set the time in milliseconds between each check for an RFID device
RFID.prototype.setPollPeriod = function (pollPeriod, callback) {
  var self = this;
  if (NaN(pollPeriod)) {
    if (callback) {
      err = new Error('NaN');
      callback(err);
      self.emit('error', err);
    }
    return;
  }
  this.pollPeriod = pollPeriod;
  if (callback) {
    self._stopListening(self._startListening(function (err) {
      if (err) {
        callback(err);
        return;
      }
      callback();
    }));
  } else {
    self._stopListening(self._startListening());
  }
};

RFID.prototype.disable = function () {
  this.irq.cancelWatch('fall');
  this._stopListening();
};

function use (hardware) {
  return new RFID(hardware);
}

exports.RFID = RFID;
exports.use = use;
