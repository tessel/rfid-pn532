// datasheet: http://www.nxp.com/documents/short_data_sheet/PN532_C1_SDS.pdf
// user manual: http://www.nxp.com/documents/user_manual/141520.pdf

//  todo: finish read mem, start anyting related to changing mem contents

var DEBUG = 0;1; // 1 if debugging, 0 if not

var tm = process.binding('tm');
var tessel = require('tessel');
var events = require('events');

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var PN532_COMMAND_INLISTPASSIVETARGET = 0x4A;
var PN532_COMMAND_GETFIRMWAREVERSION = 0x02;
var PN532_COMMAND_SAMCONFIGURATION = 0x14;
var PN532_I2C_READY = 0x01;
var PN532_PREAMBLE = 0x00;
var PN532_STARTCODE1 = 0x00;
var PN532_STARTCODE2 = 0xFF;
var PN532_POSTAMBLE = 0x00;
var PN532_I2C_ADDRESS = 0x48 >> 1;
var PN532_I2C_READBIT = 0x01;
var PN532_I2C_BUSY = 0x00;
var PN532_I2C_READY = 0x01;
var PN532_I2C_READYTIMEOUT = 20;
var PN532_HOSTTOPN532 = 0xD4;
var PN532_MIFARE_ISO14443A = 0x00;
var WAKE_UP_TIME = 100;
var PN532_COMMAND_INDATAEXCHANGE = 0x40;
var MIFARE_CMD_AUTH_A = 0x60;
var MIFARE_CMD_AUTH_B = 0x61;

function RFID (hardware, next) {
  var self = this;

  self.hardware = hardware;
  self.irq = hardware.gpio(3);
  self.irq.watch('fall', function() {
    self.emit('irq', null, 0);
  });
  self.nRST = hardware.gpio(2);
  
  self.nRST.output();
  self.nRST.low(); // Toggle reset every time we initialize

  self.i2c = new hardware.I2C(PN532_I2C_ADDRESS);
  self.i2c.initialize();

  self.numListeners = 0;
  self.listening = false;
  self.pollPeriod = 250;

  self.irq.input();
  setTimeout(function () {
    self.nRST.high();
    self.getFirmwareVersion(function (err, version) {
      if (!version) {
        throw "Cannot connect to PN532.";
      }
      else {
        self.emit('connected', version);
      }
    });
  }, WAKE_UP_TIME);

  // If we get a new listener
  self.on('newListener', function(event) {
    if (event == "data") {
      // Add to the number of things listening
      self.numListeners += 1;
      // If we're not already listening
      if (!self.listening) {
        // Start listening
        self.setListening();
      }
    }
  });

  // If we remove a listener
  self.on('removeListener', function(event) {
    if (event == "data") {
      // Remove from the number of things listening
      self.numListeners -= 1;
      // Because we listen in a while loop, if this.listening goes to 0, we'll stop listening automatically
      if (self.numListeners < 1) {
        self.listening = false;
      }
    }
  });

  self.on('removeAllListeners', function(event) {
    self.numListeners = 0;
    self.listening = false;
  });
}

util.inherits(RFID, events.EventEmitter);

RFID.prototype.initialize = function (hardware, next) {
  this.getFirmwareVersion(function(err, firmware) {
    next && next(err, firmware);
  });
  // TODO: Do something with the bank to determine the IRQ and RESET lines
}

RFID.prototype.getFirmwareVersion = function (next) {
  /*
  Ask the PN532 chip for its firmware version

  Args
    next
      Callback function; gets err, reply as args
  */
  var self = this;
  var response;

  if (DEBUG) {
    console.log("Starting firmware check...");
  }

  var commandBuffer = [PN532_COMMAND_GETFIRMWAREVERSION];

  if (DEBUG) {
    console.log('Beginning sendCommandCheckAck in getFirmwareVersion...');
  }
  self.sendCommandCheckAck(commandBuffer, function(err, ack) {
    if (DEBUG) {
      console.log('sendCommandCheckAck complete. err ack:', err, ack);
    }
    if (!ack) {
      next(new Error('no ack'), null);
    }
    else {
      if (DEBUG) {
        console.log('Reading wire data in getFirmwareVersion');
      }
      self.wireReadData(12, function (err, firmware) {
        if (DEBUG) {
          console.log("FIRMWARE: ", firmware);
          console.log("cleaned firmware: ", response);
        }
        self.SAMConfig(next);
      });
    }
  });
}

RFID.prototype.readPassiveTargetID = function (cardBaudRate, next) {
  /*
  Passes the UID of the next ISO14443A target that is read to te callback

  Args
    cardBaudRate
      Baud rate of RF communication with card. When in doubt, use 0.
    next
      Callback function; gets err, reply as args
  */
  var self = this;
  self.readCard(cardBaudRate, function(err, Card) {
    Card && next && next(err, Card.uid || null);
  });
}

RFID.prototype.SAMConfig = function (next) {
  //  Configure the Secure Access Module
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_SAMCONFIGURATION,
    0x01,
    0x14,
    0x01
  ];
  
  self.sendCommandCheckAck(commandBuffer, function(err, ack) {
    if (!ack || err) {
      if (DEBUG) {
        console.log('failed to SAMConfig');
      }
      next(err, false);
    } 
    // Read data packet
    else {
      self.wireReadData(8, function(err, response) {
        if (DEBUG) {
          console.log('SAMConfig response:\n', err, '\n', response);
        }
        next(err, response);
      });
    }
  });
}

RFID.prototype.sendCommandCheckAck = function (cmd, next) {
  /*
  Send a command, check that the module acknowledges

  Args
    cmd
      Command to send
    next
      Callback function; gets err, reply as args
  */
  var self = this;
  self.wireSendCommand(cmd, function(err, data) {
    if (DEBUG) {
      console.log('kickback from readreg:\n', err, '\n', data);
    }
  });

  self.once('irq', function(err, data) {
    self.readAckFrame(function(err, ackbuff) {
      if (err) {
        next && next(err, null);
      }
      else {
        next && next((!ackbuff || !checkPacket(ackbuff)) ? new Error('ackbuff was invalid') : null, ackbuff);
      }
    });
  });
}

RFID.prototype.wireSendCommand = function (cmd, next) {
  /*
  Add the proper header, footer, checksums, etc. and send the command

  Args
    cmd
      Command to send
    next
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
  self.writeRegister(sendCommand, next);
} 

RFID.prototype.readAckFrame = function (next) {
  // Read in what is hopefully a positive acknowledge from the PN532
  this.wireReadData(6, function(err, ackbuff) {
    next(err, ackbuff);
  });
}

RFID.prototype.wireReadStatus = function () {
  //  Check the status of the IRQ pin
  var x = this.irq.readSync();
  if (x == 1)
    return PN532_I2C_BUSY;
  else
    return PN532_I2C_READY;
}

RFID.prototype.wireReadData = function (numBytes, next) {
  /*
  Read in numBytes of data (0-63) from the PN532's I2C buffer

  Args
    numBytes
      Number of bytes to read (0-63)
    next
      Callback function; gets err, reply as args
  */
  b = new Buffer(0);
  this.readRegisters(b, numBytes + 2, function(err, reply) {
    next && next(err, reply);
  });
}

RFID.prototype.readRegisters = function (dataToWrite, bytesToRead, next) {
  /*
  Read and write data from/to the PN532's I2C buffer

  Args
    dataToWrite
      What to write to the buffer
    bytesToRead
      How many reply bytes to read back
    next
        Callback function; gets err, reply as args
  */
  var self = this;
  var bufferToWrite = new Buffer(dataToWrite.length);
  bufferToWrite.fill(0);
  for (var i = 0; i < dataToWrite.length; i++) {
    if (dataToWrite[i]) {
      bufferToWrite[i] = dataToWrite[i];
    }
  }
  if (DEBUG) {
    var s = '[';
    for (var i = 0; i < dataToWrite.length; i++) {
      s += dataToWrite[i].toString(16) + ', ';
    }
    s = s.slice(0, s.length-2) + ']';
    console.log('\n\ttrying to read by sending:\n\t', s);
  }
  this.i2c.transfer(bufferToWrite, bytesToRead, function (err, data) {
    if (DEBUG) {
      var s = '[';
      for (var i = 0; i < data.length; i++) {
        s += '0x'+data[i].toString(16) + ', ';
      }
      s = s.slice(0, s.length-2) + ']';
      console.log('\treply:\n\t', err, '\n\t', s, '\n');
    }
    if (next && checkPacket(data)) {
      if (DEBUG) {
        console.log('packet verified:\n', data);
      }
      next(err, data);
    }
    else {
      if (DEBUG) {
        console.log('invalid packet:\n', data);
      }
      next && next(new Error('packet improperly formed'), data);
    }
  });
}

RFID.prototype.writeRegister = function (dataToWrite, next) {
  /*
  Write data to the PN532's I2C register

  Args
    dataToWrite
      Data to write to buffer
    next
      Callback function; gets err, reply as args
  */
  var bufferToWrite = new Buffer(dataToWrite.length);
  bufferToWrite.fill(0);
  for (var i = 0; i < dataToWrite.length; i++) {
    if (dataToWrite[i]) {
      bufferToWrite[i] = dataToWrite[i];
    }
  }
  if (DEBUG) {
    var s = '[';
    for (var i = 0; i < dataToWrite.length; i++) {
      s += '0x'+dataToWrite[i].toString(16) + ', '
    }
    s = s.slice(0, s.length-2) + ']';
    console.log('\n\twriting buffer:\n\t', s, '\n');
  }

  this.i2c.send(bufferToWrite, function(err, reply) {
    next && next(err, reply);
  });
}

RFID.prototype.readCard = function(cardBaudRate, next) {
  /*
  Read the contents of the card, call the callback with the resulting Buffer

  Args
    cardBaudRate
      Baud rate used for communication with the card
    next
      Callback function; args: err, data

  TODO: use IRQ interrupt instead of polling
  */
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_INLISTPASSIVETARGET,
    1,
    cardBaudRate
  ];
  
  self.sendCommandCheckAck(commandBuffer, function(err, ack) {
    if (err || !ack) {
      next && next(err, ack);
    }
    else {
      // Wait for a card to enter the field
      var status = PN532_I2C_BUSY;
      var parseCard = function(err, res) {
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

        var Card = new Object();
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
        next && next(err, Card);
      }
      var waitLoop = setInterval(function() {
        if (self.wireReadStatus() === PN532_I2C_READY) {
          clearInterval(waitLoop);
          // read data packet
          var dataLength = 20;
          self.wireReadData(dataLength, function(err, res) {
            if (!err && checkPacket(res)) {
              parseCard(err, res);
            }
            else {
              next && next(err || new Error('invalid packet'), res);
            }
          });
        }
      }, 50);
    }
  });
}

RFID.prototype.setListening = function () {
  //  Configure the module to automatically emit UIDs
  var self = this;
  self.listening = true;
  self.numListeners++;
  // Loop until nothing is listening
  self.listeningLoop = setInterval(function () {
    if (self.numListeners) {
      self.readPassiveTargetID(PN532_MIFARE_ISO14443A, function(err, uid) {
        if (!err && uid) {
          self.emit('rfid-uid', uid);
        }
      });
    }
    else {
      clearInterval(listeningLoop);
    }
  }, self.pollPeriod);
}

var checkPacket = function(packet) {
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

  var successfulAck = [(0x0 || 0x1), 0x0, 0x0, 0xff, 0x0, 0xff]; // index 0 depends on direction of transfer

  //  option 1: ack packet
  var isAck = true;
  for (var i = 1; i < successfulAck.length; i++) {
    isAck = isAck && (successfulAck[i] === packet[i]);
  }
  if (isAck) {
    return true;
  }
  //  option 2: the packet is valid via headers, cheksum
  else if ((packet[1] === 0 && packet[2] === 0 && packet[3] === 0xff) && (packet[4] + packet[5]) % 256 === 0 ) {
    //  passes start of packet and length checksum
    var dl = packet[4];
    var check = 0;
    for (var i = 6; i <= dl + 6; i++) {
      if (packet[i] != undefined) {
        check += packet[i];
      }
      else {
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
}

exports.RFID = RFID;

exports.connect = function (hardware, portBank) {
  return new RFID(hardware, portBank);
} 