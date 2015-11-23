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
var PN532_COMMAND_INDATAEXCHANGE = 0x40;
var PN532_PREAMBLE = 0x00;
var PN532_STARTCODE1 = 0x00;
var PN532_STARTCODE2 = 0xFF;
var PN532_POSTAMBLE = 0x00;
var PN532_I2C_ADDRESS = 0x48 >> 1;
var PN532_I2C_READBIT = 0x01;
var PN532_I2C_READY = 0x00;
var PN532_I2C_BUSY = 0x01;
var PN532_I2C_READYTIMEOUT = 20;
var PN532_HOSTTOPN532 = 0xD4;
var PN532_MIFARE_ISO14443A = 0x00;
var WAKE_UP_TIME = 100;

var MIFARE_CMD_AUTH_A = 0x60;
var MIFARE_CMD_AUTH_B = 0x61;
var MIFARE_CMD_READ = 0x30;
var MIFARE_CMD_WRITE = 0xA0;

function RFID (hardware, options, callback) {
  var self = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  self.hardware = hardware;
  self.ready = false;
  self.irq = hardware.digital[2];
  self.irq.input();

  self.nRST = hardware.digital[1];

  // Toggle reset every time we initialize
  self.nRST.write(false, function continueInit() {

    self.i2c = new hardware.I2C(PN532_I2C_ADDRESS);

    // This function only exists on the Tessel 1
    if (typeof self.i2c._initialize === 'function') {
      self.i2c._initialize();
    }

    self.numListeners = 0;
    self.listening = false;

    self.autoReset = true;
    self.resetTimeout = 300;
    if (options) {
      if (options.hasOwnProperty('listen')) {
        self.autoReset = options.listen;
      }
      if (options.hasOwnProperty('delay')){
        self.resetTimeout = options.delay;
      }
    }

    setTimeout(function () {
      self.nRST.write(true, function continueAfterRst() {
        self._getFirmwareVersion(function (err, version) {
          if (!version) {
            self.emit('error', err);
            if (callback) {
              callback(err);
            }
          } else {
            if (callback) {
              callback(null, self);
            }
            setImmediate(function() {
              self.emit('ready');
            });
            self.ready = true;
          }
        });
      });
    }, WAKE_UP_TIME);

    // If we get a new listener
    self.on('newListener', function (event) {
      if (event == 'data' || event == 'read') {
        // Add to the number of things listening
        self.numListeners += 1;
        // If we're not already listening
        if (!self.ready) {
          self.once('ready', self.startListening.bind(self));
        }
        else if (!self.listening) {
          // Start listening
          self.startListening();
        }
      }
    });

    // If we remove a listener
    self.on('removeListener', function (event) {
      if (event == 'data' || event == 'read') {
        // Remove from the number of things listening
        self.numListeners -= 1;
        // Because we listen in a while loop, if this.listening goes to 0, we'll stop listening automatically
        if (self.numListeners < 1) {
          self.listening = false;
        }
      }
    });

    self.on('removeAllListeners', function () {
      self.numListeners = 0;
    });
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

RFID.prototype._getCard = function (cardBaudRate, callback) {
  /*
  Passes the information of the next ISO14443A target that is read to the callback

  Args
    cardBaudRate
      Baud rate of RF communication with card. When in doubt, use 0.
    callback
      Callback function; gets err, reply as args
  */
  var self = this;
  self._read(cardBaudRate, function (err, card) {
    if (card && callback) {
      callback(err, card);
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
        Card.header = [].slice.apply(res.slice(0, 7));                // Frame header & preamble
        Card.numTags = res[7];                                        // Tags found
        Card.tagNum = res[8];                                         // Tag number
        Card.SENS_RES = [].slice.apply(res.slice(9, 11));             // SENS_RES
        Card.SEL_RES = res[11];                                       // SEL_RES
        Card.idLength = res[12];                                      // NFCID Length
        Card.uid = res.slice(13, 13 + Card.idLength);                 // NFCID buffer

        if (DEBUG) {
          console.log('Parsed card:\n', Card);
        }
        if (callback) {
          if (!self.listening){
            callback(new Error('Listening terminated'));
          } else{
            callback(err, Card);
          }
        }
      };
      // When the module is ready to respond
      self.irq.once('low', function ready() {
        var dataLength = 32;
        // Read the card data
        self._wireReadData(dataLength, function (err, res) {
          if (!err && self._checkPacket(res)) {
            parseCard(err, res);
          } else {
            if (callback) {
              callback(err || new Error('invalid packet'), res);
            }
          }
        });
      });
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

  // When the module is ready to respond
  self.irq.once('low', function ready() {
    // Read the acknowledgement frame and ensure is formatted properly
    self._readAckFrame(function (err, ackbuff) {
      if (DEBUG) {
        console.log('_readAckFrame: err', err, 'data', ackbuff);
      }
      if (err && callback) {
        callback(err, null);
      } else if (callback) {
        callback((!ackbuff || !self._checkAck(ackbuff)) ? new Error('ackbuff was invalid') : null, ackbuff);
      }
    });
  });
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

RFID.prototype.mifareClassicAuthenticateBlock = function( uid, blockNumber, keyNumber, keyData, callback) {
  var self = this;
  if (Buffer.isBuffer(uid)) {
    uid = [].slice.apply(uid);
  }
  var commandBuffer = [
    PN532_COMMAND_INDATAEXCHANGE,
    1,
    keyNumber ? MIFARE_CMD_AUTH_B : MIFARE_CMD_AUTH_A,
    blockNumber
  ].concat(keyData).concat(uid);

  self._sendCommandCheckAck(commandBuffer, function (err, ack) {
    if (err || !ack) {
      if (callback) {
        callback(err, ack);
      }
    } else {
      self.irq.once('low', function ready() {
        // read data packet
        var dataLength = 26;
        self._wireReadData(dataLength, function (err, res) {
          if (!err && res[8] == 0x00) {
            if (callback) {
              callback(err);
            }
          } else {
            if (callback) {
              callback(err || new Error('invalid packet'), res);
            }
          }
        });
      });
    }
  });
};

RFID.prototype.mifareClassicReadBlock = function (blockNumber, callback) {
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_INDATAEXCHANGE,
    1,
    MIFARE_CMD_READ,
    blockNumber
  ];

  self._sendCommandCheckAck(commandBuffer, function (err, ack) {
    if (err || !ack) {
      if (callback) {
        callback(err, ack);
      }
      return;
    } else {
      self.irq.once('low', function ready() {
        // read data packet
        var dataLength = 26;
        self._wireReadData(dataLength, function (err, res) {
          if (!err && res[8] == 0x00) {
            if (callback){
              callback(err, res.slice(9,9+16));
            }
          } else {
            if (callback) {
              callback(err || new Error('invalid packet'), res);
            }
          }
        });
      });
    }
  });
};

RFID.prototype.mifareClassicWriteBlock = function (blockNumber, data, callback) {
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_INDATAEXCHANGE,
    1,
    MIFARE_CMD_WRITE,
    blockNumber
  ].concat(data);

  self._sendCommandCheckAck(commandBuffer, function (err, ack) {
    if (err || !ack) {
      if (callback) {
        callback(err, ack);
      }
    } else {
      // When the module is ready to respond
      self.irq.once('low', function() {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }
        else {
          // read data packet
          var dataLength = 26;
          self._wireReadData(dataLength, function (err, res) {
            if (!err) {
              if (callback){
                callback(err);
              }
            } else {
              if (callback) {
                callback(err || new Error('invalid packet'), res);
              }
            }
          });
        }
      });
    }
  });
};

RFID.prototype.startListening = function (callback) {
  //  Configure the module to automatically emit UIDs
  var self = this;
  self.listening = true;
  // Loop until nothing is listening
  if (self.numListeners) {
    self._getCard(PN532_MIFARE_ISO14443A, function (err, card) {
      if (!err && card && card.uid && self.listening) {
        self.emit('data', card); // streams1-like event
        self.emit('read', card); // explicit read event
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
      if (self.autoReset && self.listening) {
        setTimeout(self.startListening.bind(self), self.resetTimeout);
      }
    });
  } else {
    if (callback) {
      self.stopListening(callback);
    } else {
      self.stopListening();
    }
  }
};

RFID.prototype.stopListening = function (callback) {
  var self = this;
  self.listening = false;
  self.autoReset = false;
  if (callback) {
    callback();
  }
};

RFID.prototype.disable = function () {
  this.irq.removeAllListeners();
  this.stopListening();
};

RFID.prototype.setPollPeriod = function(ms, callback) {
  if (ms === undefined || typeof ms != 'number') {
    if (callback) {
      return callback(new Error("Invalid poll period: " + ms + ". Should be a number of milliseconds."));
    }
  }

  this.resetTimeout = ms;

  if (callback) {
    callback();
  }

}

function use (hardware, options, callback) {
  return new RFID(hardware, options, callback);
}

exports.RFID = RFID;
exports.use = use;
