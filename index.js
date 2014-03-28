// datasheet: http://www.nxp.com/documents/short_data_sheet/PN532_C1_SDS.pdf
// user manual: http://www.nxp.com/documents/user_manual/141520.pdf

var DEBUG = 1; // 1 if debugging, 0 if not

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

var led1 = tessel.led(1).output().low();
var led2 = tessel.led(2).output().low();

var packetBuffer = [];

function RFID (hardware, next) {
  var self = this;

  self.hardware = hardware;
  self.irq = hardware.gpio(3);
  self.nRST = hardware.gpio(2);
  self.numListeners = 0;
  self.listening = false;
  self.pollFrequency = 100;

  self.nRST.output();
  self.nRST.low(); // toggle reset every time we initialize

  self.i2c = new hardware.I2C(PN532_I2C_ADDRESS);
  self.i2c.initialize();

  self.irq.input();
  setTimeout(function () {
    self.nRST.high();
    self.getFirmwareVersion(function (err, version) {
      if (!version) {
        throw "Cannot connect to PN532.";
      } else {
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
  this.getFirmwareVersion(function(err, firmware){
    if (firmware) {
      next(err, firmware);
    } else {
      return firmware;
    }
  });
  // TODO: Do something with the bank to determine the IRQ and RESET lines
  // Once Reset actually works...
}

/**************************************************************************/
/*! 
    @brief  Checks the firmware version of the PN5xx chip

    @returns  The chip's firmware version and ID
*/
/**************************************************************************/
RFID.prototype.getFirmwareVersion = function (next) {
  var self = this;
  var response;

  if (DEBUG) {
    console.log("Starting firmware check...");
  }

  var commandBuffer = [PN532_COMMAND_GETFIRMWAREVERSION];

  if (DEBUG) {
    console.log('Beginning sendCommandCheckAck in getFirmwareVersion...');
  }
  self.sendCommandCheckAck(commandBuffer, 1, function(err, ack){
    if (DEBUG) {
      console.log('sendCommandCheckAck complete. err ack:', err, ack);
    }
    if (!ack){
      if (next) {
        return next(err, 0);
      } else {
        if (DEBUG) {
          console.log('Err no callback sent to getFirmwareVerson');
        }
        return 0;
      }
    }

    if (DEBUG) {
      console.log('Reading wire data in getFirmwareVersion');
    }
    self.wireReadData(12, function (err, firmware){
      if (DEBUG) {
        console.log("FIRMWARE: ", firmware);
        console.log("cleaned firmware: ", response);
      }
      self.SAMConfig(next);
    });
  });
}

/**************************************************************************/
/*! 
    Waits for an ISO14443A target to enter the field
    
    @param  cardBaudRate  Baud rate of the card
    @param  uid           Pointer to the array that will be populated
                          with the card's UID (up to 7 bytes)
    @param  uidLength     Pointer to the variable that will hold the
                          length of the card's UID.
    
    @returns 1 if everything executed properly, 0 for an error
*/
/**************************************************************************/
RFID.prototype.readPassiveTargetID = function (cardbaudrate, next) {
  var self = this;
  self.readCard(cardbaudrate, function(err, Card){
    // if (next) {
    //   next(err, Card.uid);
    // } else {
    //   return Card.uid;
    // }
    next && next(err, Card.uid);
  });
}

/**************************************************************************/
/*! 
    @brief  Configures the SAM (Secure Access Module)
*/
/**************************************************************************/
RFID.prototype.SAMConfig = function (next) {
  if (!next) {
    console.log('Err no callback sent to SAMConfig');
    return false;
  }
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_SAMCONFIGURATION,
    0x01,
    0x14,
    0x01
  ];
  
  self.sendCommandCheckAck(commandBuffer, 4, function(err, ack){
    if (!ack || err){
      return next(err, false);
    } 
    // read data packet
    self.wireReadData(8, function(err, response){
      next(err, response);
      led1.high();
    });
  });
}


/**************************************************************************/
/*! 
    @brief  Sends a command and waits a specified period for the ACK

    @param  cmd       Pointer to the command buffer
    @param  cmdlen    The size of the command in bytes 
    @param  timeout   timeout before giving up
    
    @returns  1 if everything is OK, 0 if timeout occured before an
              ACK was recieved
*/
/**************************************************************************/

RFID.prototype.sendCommandCheckAck = function (cmd, cmdlen, next) {
  if (!next) {
    console.log('Err no callback sent to sendCommandCheckAck');
    return false;
  }
  var self = this;
  // write the command
  self.wireSendCommand(cmd, cmdlen);
  var timer = 0;
  var timeout = 100; // 1 second, intervals of 10 ms

  if (DEBUG) {
    console.log('Waiting for connection to module...');
  }
  return checkReadiness(timer);

  function checkReadiness (timer) {
    var stat = self.wireReadStatus();
    if (stat == PN532_I2C_READY) {    // PN532_I2C_READY = 1
      if (DEBUG) {
        console.log('Status: Ready!');
      }
      self.readAckFrame(function(err, ackbuff){
        if (!ackbuff){
          next(new Error('ackbuff was false'), false);
        } else {
          next(null, true);
        }
      });
    } else if (timer > timeout) {
      if (DEBUG) {
        console.log('Connection timed out.');
      }
      return false;
    } else {
      if (DEBUG) {
        console.log('Something went wrong, so let\'s try again.\n\tstat:\t', stat, '\tready:\t', PN532_I2C_READY);
      }
      setTimeout(function(){
        checkReadiness(timer + 1);
      }, 10);
    }
  }
}

/**************************************************************************/
/*! 
    @brief  Writes a command to the PN532, automatically inserting the
            preamble and required frame details (checksum, len, etc.)

    @param  cmd       Pointer to the command buffer
*/
/**************************************************************************/
RFID.prototype.wireSendCommand = function (cmd, cmdlen) {
  var checksum;
  var self = this;

  cmdlen++;

 //  tessel.sleep(2);     // or whatever the delay is for waking up the board

  checksum = -1;

  var sendCommand = [PN532_PREAMBLE, 
    PN532_PREAMBLE, 
    PN532_STARTCODE2, 
    cmdlen, 
    (255 - cmdlen) + 1, 
    PN532_HOSTTOPN532];

  checksum += PN532_HOSTTOPN532;

  for (var i=0; i<cmdlen-1; i++) {
    sendCommand.push(cmd[i]);
    if(cmd[i]) {
      checksum += cmd[i];
    }
  }
  checksum = checksum % 256;
  sendCommand.push((255 - checksum));
  sendCommand.push(PN532_POSTAMBLE);
  self.writeRegister(sendCommand);

} 

/**************************************************************************/
/*! 
    @brief  Tries to read the PN532 ACK frame (not to be confused with 
          the I2C ACK signal)
*/
/**************************************************************************/
RFID.prototype.readAckFrame = function (next) {
  if (!next) {
    console.log(next, err, 'Err no callback sent to readAckFrame');
    return false;
  }
  this.wireReadData(6, function(err, ackbuff){
    next(err, ackbuff);
  });
}

RFID.prototype.wireReadStatus = function () {
  var x = this.irq.read();

  if (DEBUG) {
    console.log("IRQ", x);
  }

  if (x == 1)
    return PN532_I2C_BUSY;
  else
    return PN532_I2C_READY;
}

/**************************************************************************/
/*! 
    @brief  Reads n bytes of data from the PN532 via I2C

    @param  buff      Pointer to the buffer where data will be written
    @param  n         Number of bytes to be read
*/
/**************************************************************************/
RFID.prototype.wireReadData = function (numBytes, next) {
  // tessel.sleep(2); 
  this.readRegisters([], numBytes+2, function(err, response){
    next && next(err, response);
  });

}


/**************************************************************************/
/*! 
    @brief  I2C Helper Functions Below
*/
/**************************************************************************/
RFID.prototype.readRegisters = function (dataToWrite, bytesToRead, next) {

  this.i2c.transfer(Buffer.isBuffer(dataToWrite) ? dataToWrite : new Buffer(dataToWrite), bytesToRead, function (err, data) {
    next && next(err, data);
  });
}


// Write a buffer of Bytes to the register.
RFID.prototype.writeRegister  = function (dataToWrite, next) {
  this.i2c.send(Buffer.isBuffer(dataToWrite) ? dataToWrite : new Buffer(dataToWrite), function(err, data) {
    next && next(err, data);
  });
  // next && next(reply); // the old way
  //  TODO
  //  Modify everything to give this function Buffers instead of Arrays
}


RFID.prototype.setListening = function () {
  var self = this;
  self.listening = true;
  // Loop until nothing is listening
  self.listeningLoop = setInterval (function () {
    if (self.numListeners) {
      self.readPassiveTargetID(PN532_MIFARE_ISO14443A, function(err, uid){
        led2.high();
        self.emit('data', uid);
        led2.low();
      });
    } else {
      clearInterval(listeningLoop);
    }
  }, self.pollFrequency);
}

RFID.prototype.readCard = function(cardbaudrate, next) {
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_INLISTPASSIVETARGET,
    1,
    cardbaudrate
  ];
  
  self.sendCommandCheckAck(commandBuffer, 3, function(err, ack){
    if (!ack) {
      if (next) {
        return next(null, 0x0);
      }
      console.log('Err no contingency');
      return 0;
    }
     // Wait for a card to enter the field
    var status = PN532_I2C_BUSY;
    var waitLoop = setInterval(function(){
      if (self.wireReadStatus() === PN532_I2C_READY){
        // A card has arrived! Stop waiting.
        clearInterval(waitLoop);
        // read data packet
        var dataLength = 20;
        self.wireReadData(dataLength, function(err, res){
          // parse data packet into component parts

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
          Card.header = res.slice(0,7);              // Frame header and preamble
          Card.numTags = res[7];                     // Tags found
          Card.tagNum = res[8];                      // Tag number
          Card.SENS_RES = res.slice(9,11);           // SENS_RES
          Card.SEL_RES = res[11];                    // SEL_RES
          Card.idLength = res[12];                   // NFCID Length
          Card.uid = res.slice(13,13+Card.idLength); // NFCID

          next && next(err, Card);
        });
      }
    }, 10);
  });
}

/*
ACCESSING EEPROM
- Get 4-byte (or 7-byte) UID
  - Select card
  - card returns SAK (Select Acknowledge) code (see sec. 9.4, see ref.7)
- Authenticate chosen sector according to its rules (def in its trailer block)
  by passing 6 byt Auth key
  - Authentication key: 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF for new cards
  - Three pass auth
    - specify sector to be accessed, choose key A or B
    - card sends random number as challenge to reader
    - reader calculates response to challenge using secret key
    - reader sends response, additional random number challenge
    - card verifies reader response, sends its own challenge response back
    - reader verifies response
- Mem ops
  - read block
  - write block
  - decrement
  - increment
  - restore
  - transfer
*/

RFID.prototype.miFareClassicIsFirstBlock = function (uiBlock) {
  // Test sector size
  if (uiBlock < 128) {
    return ((uiBlock) % 4 == 0);
  } else {
    return ((uiBlock) % 16 == 0);
  }
}

/**************************************************************************/
/*! 
    Tries to authenticate a block of memory on a MIFARE card using the
    INDATAEXCHANGE command.  See section 7.3.8 of the PN532 User Manual
    for more information on sending MIFARE and other commands.

    @param  uid           Pointer to a byte array containing the card UID
    @param  uidLen        The length (in bytes) of the card's UID (Should
                          be 4 for MIFARE Classic)
    @param  blockNumber   The block number to authenticate.  (0..63 for
                          1KB cards, and 0..255 for 4KB cards).
    @param  keyNumber     Which key type to use during authentication
                          (0 = MIFARE_CMD_AUTH_A, 1 = MIFARE_CMD_AUTH_B)
    @param  keyData       Pointer to a byte array containing the 6 byte
                          key value
    
    @returns 1 if everything executed properly, 0 for an error
*/
/**************************************************************************/

RFID.prototype.miFareClassicAuthenticateBlock = function (uid, uidLen, blockNumber, keyNumber, keyData) {
  var self = this;
  var len;
  var chosenKey; // A or B, depending on whether keyNumber is 1 or 0

  if (keyNumber) {
    chosenKey = MIFARE_CMD_AUTH_B;
  } else {
    chosenKey = MIFARE_CMD_AUTH_A;
  }

  console.log('Trying to authenticate card...');
  pn532_packetbuffer = [
    PN532_COMMAND_INDATAEXCHANGE,   // Data exchange header
    1,                              // Max card numbers
    chosenKey,                      // See if statement above
    blockNumber];                   // Block number (1K = 0..63, 4k = 0..255)

  for (var i = 0; i < uidLen; i++) {
    pn532_packetbuffer[10+i] = uid[i];
  }

  self.sendCommandCheckAck(pn532_packetbuffer, 10 + uidLen, function(err, ack) {
    if (!ack) {
      console.log('Failed sendCommandCheckAck in miFareClassicAuthenticateBlock');
      return 0;
    }
  });

  // Read response packet
  self.wireReadData(pn532_packetbuffer, 12);//I don't think this is right ~e

  // Check if the response is valid and we are authenticated???
  // for an auth success it should be bytes 5-7: 0xD5 0x41 0x00
  // Mifare auth error is technically byte 7: 0x14 but anything other and 0x00 is not good
  if (pn532_packetbuffer[7] != 0x00)
  {
    console.log("Authentification failed: ");
    return 0;
  }  
  return 1;
}

RFID.prototype.accessMem = function() {
  var self = this;
  var authenticated; // flag whether or not block is authenticated
  var success; // on authentication
  var keyuniversal = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
  // var uidLen = 4; // for mifare Classic. Figure out a way to do this more elegantly.

  self.readCard(PN532_MIFARE_ISO14443A, function(Card) {
    // Try to go through all 16 sectors (each has 4 blocks)
    // authenticating each sector and then dumping the blocks
    for (var currentblock = 0; currentblock < 64; currentblock++) {
      // Find out if it's a new block (if we need to re-authenticate)
      if(self.miFareClassicIsFirstBlock(currentblock)) {
        authenticated = false;
      }
      if (authenticated == false) {
        // re-authenticate
        console.log('------------------------ Sector', currentblock, '------------------------');
        if (currentblock == 0) {
          // This will be 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF for Mifare Classic (non-NDEF!)
          // or 0xA0 0xA1 0xA2 0xA3 0xA4 0xA5 for NDEF formatted cards using key a,
          // but keyb should be the same for both (0xFF 0xFF 0xFF 0xFF 0xFF 0xFF)
          success = self.miFareClassicAuthenticateBlock (Card.uid, Card.uid.length, currentblock, 1, keyuniversal);
        } else {
          // This will be 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF for Mifare Classic (non-NDEF!)
          // or 0xD3 0xF7 0xD3 0xF7 0xD3 0xF7 for NDEF formatted cards using key a,
          // but keyb should be the same for both (0xFF 0xFF 0xFF 0xFF 0xFF 0xFF)
          success = self.miFareClassicAuthenticateBlock (Card.uid, Card.uid.length, currentblock, 1, keyuniversal);
        }
        if (success) { // check to make sure auth worked
          authenticated = true;
        } else {
          console.log('Authentication error');
        }
      }
    }
  });
}


  // var authKey = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
  // led1.high();
  // //get uid
  // self.readCard(PN532_MIFARE_ISO14443A, function(Card) {
  //   led2.high();
  //   led2.low();
  //   console.log(Card);
  //   //write 6-byte auth key
  //   console.log('writing...')
  //   self.writeRegister(authKey);
  //   console.log('theoretically written')
  //   self.wireReadData(20, function(res) {
  //     console.log(res)
  //   });
  // });
// }

exports.RFID = RFID;
exports.connect = function (hardware, portBank) {
  return new RFID(hardware, portBank);
}