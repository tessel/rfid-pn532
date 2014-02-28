// datasheet: http://www.nxp.com/documents/short_data_sheet/PN532_C1_SDS.pdf
// user manual: http://www.nxp.com/documents/user_manual/141520.pdf

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
    self.getFirmwareVersion(function (version) {
      if (!version) {
        throw "Cannot connect to pn532.";
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
  this.getFirmwareVersion(function(firmware){
    next(firmware);
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

  // console.log("Starting firmware check...");

  var commandBuffer = [PN532_COMMAND_GETFIRMWAREVERSION];

  self.sendCommandCheckAck(commandBuffer, 1, function(ack){
    if (!ack){
      return next(0);
    }

    self.wirereaddata(12, function (firmware){
      // console.log("FIRMWARE: ", firmware);
      // console.log("cleaned firmware: ", response);
      self.SAMConfig(next);
    });
  });

  // read data packet
  

  
  
  // check some basic stuff
 //  if (0 != strncmp((char *)pn532_packetbuffer, (char *)pn532response_firmwarevers, 6)) {
 //    #ifdef PN532DEBUG
 //    Serial.println("Firmware doesn't match!");
  // #endif
 //    return 0;
 //  }
  
  // response = firmware[7];
  // response <<= 8;
  // response |= firmware[8];
  // response <<= 8;
  // response |= firmware[9];
  // response <<= 8;
  // response |= firmware[10];

  // console.log("cleaned firmware: ", response);
  // return response;
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
  self.readCard(cardbaudrate, function(Card){
    next(Card.uid);
  });

  // var commandBuffer = [
  //   PN532_COMMAND_INLISTPASSIVETARGET,
  //   1,
  //   cardbaudrate
  // ];
  
  // self.sendCommandCheckAck(commandBuffer, 3, function(ack){
  //   if (!ack) {
  //     return next(0x0);
  //   }
  //    // Wait for a card to enter the field
  //   var status = PN532_I2C_BUSY;
  //   var waitLoop = setInterval(function(){
  //     if (self.wirereadstatus() === PN532_I2C_READY){
  //       clearInterval(waitLoop);

        // check some basic stuff
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

  //       // read data packet
  //       self.wirereaddata(20, function(response){
  //         // console.log("got response", response);
  //         // if (response[7] != 1){
  //           // return next(0x0);
  //         // }

  //         var uid = [];
  //         for (var i=0; i < response[12]; i++) 
  //         {
  //           console.log(response)
  //           uid[i] = response[13+i];
  //         }
  //         next(uid);
  //       });
  //     }
  //   }, 10);
  // });
}

/**************************************************************************/
/*! 
    @brief  Configures the SAM (Secure Access Module)
*/
/**************************************************************************/
RFID.prototype.SAMConfig = function (next) {
  var self = this;
  var commandBuffer = [
    PN532_COMMAND_SAMCONFIGURATION,
    0x01,
    0x14,
    0x01
  ];
  
  self.sendCommandCheckAck(commandBuffer, 4, function(ack){
    if (!ack){
      return next(false);
    } 
    // read data packet
    self.wirereaddata(8, function(response){
      next(response);
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
// default timeout of one second
RFID.prototype.sendCommandCheckAck = function (cmd, cmdlen, next) {
  var self = this;
  // write the command
  self.wiresendcommand(cmd, cmdlen);
  var timer = 0;
  var timeout = 50;

  return checkReadiness(timer);

  function checkReadiness (timer) {
    if (self.wirereadstatus() == PN532_I2C_READY) {
      // console.log('Status: Ready!');
      self.readackframe(function(ackbuff){
        if (!ackbuff){
          next(false);
        } else {
          next(true);
        }
      });
    } else if (timer > timeout) {
      // console.log('Connection timed out.');
      return false;
    } else {
      setTimeout(checkReadiness(timer + 1), 10);
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
RFID.prototype.wiresendcommand = function (cmd, cmdlen) {
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
    checksum += cmd[i];
  }
  checksum = checksum % 256;
  sendCommand.push((255 - checksum));
  sendCommand.push(PN532_POSTAMBLE);
  self.write_register(sendCommand);

} 

/**************************************************************************/
/*! 
    @brief  Tries to read the PN532 ACK frame (not to be confused with 
          the I2C ACK signal)
*/
/**************************************************************************/
RFID.prototype.readackframe = function (next) {
  
   this.wirereaddata(6, function(ackbuff){
    next(ackbuff);
   });
}

RFID.prototype.wirereadstatus = function () {
  var x = this.irq.read();

  // console.log("IRQ", x);

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
RFID.prototype.wirereaddata = function (numBytes, next) {
  
  // tessel.sleep(2); 
  this.read_registers([], numBytes+2, function(err, response){
    next(response);
  });

}


/**************************************************************************/
/*! 
    @brief  I2C Helper Functions Below
*/
/**************************************************************************/
RFID.prototype.read_registers = function (dataToWrite, bytesToRead, next) {

  this.i2c.transfer(dataToWrite, bytesToRead, function (err, data) {
    next(err, data);
  });
}


// Write a single byte to the register.
RFID.prototype.write_register  = function (dataToWrite) {
  return this.i2c.send(dataToWrite);
}

// Write a single byte to the register.
RFID.prototype.write_one_register = function (dataToWrite) {
  return this.i2c.send([dataToWrite]);
}

RFID.prototype.setListening = function () {
  var self = this;
  self.listening = true;
  // Loop until nothing is listening
  self.listeningLoop = setInterval (function () {
    if (self.numListeners) {
      self.readPassiveTargetID(PN532_MIFARE_ISO14443A, function(uid){
        led2.high();
        self.emit('data', uid);
        led2.low();
      });
    } else {
      clearInterval(listeningLoop);
    }
  }, self.pollFrequency);
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

RFID.prototype.readCard = function(cardbaudrate, next) {
  var self = this
  var commandBuffer = [
    PN532_COMMAND_INLISTPASSIVETARGET,
    1,
    cardbaudrate
  ];
  
  self.sendCommandCheckAck(commandBuffer, 3, function(ack){
    if (!ack) {
      return next(0x0);
    }
     // Wait for a card to enter the field
    var status = PN532_I2C_BUSY;
    var waitLoop = setInterval(function(){
      if (self.wirereadstatus() === PN532_I2C_READY){
        // A card has arrived! Stop waiting.
        clearInterval(waitLoop);
        // read data packet
        var dataLength = 20;
        self.wirereaddata(dataLength, function(res){
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

          next(Card);
        });
      }
    }, 10);
  });
}

RFID.prototype.accessMem = function(){
  var self = this;
  var authKey = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
  led1.high();
  //get uid
  self.readPassiveTargetID(PN532_MIFARE_ISO14443A, function(uid){
    led2.high();
    led2.low();
    //write 6-byte auth key
    console.log('writing...')
    self.write_register(authKey);
    console.log('theoretically written')
  });
}

exports.RFID = RFID;
exports.connect = function (hardware, portBank) {
  return new RFID(hardware, portBank);
}