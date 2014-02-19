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
      if (self.wirereadstatus() == PN532_I2C_READY){
        clearInterval(waitLoop);

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

        // read data packet
        self.wirereaddata(20, function(response){
          // console.log("got response", response);
          // if (response[7] != 1){
            // return next(0x0);
          // }

          var uid = [];
          for (var i=0; i < response[12]; i++) 
          {
            uid[i] = response[13+i];
          }
          next(uid);
        });
      }
    },10);
  });
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
  var timer = 0;
  var timeout = 500;
  var self = this;
  // write the command
  self.wiresendcommand(cmd, cmdlen);

  // // Wait for chip to say it's ready!
  // var waitLoop = setInterval(function(){
  //   if (self.wirereadstatus() == PN532_I2C_READY) {
  //     // Success- ready
  //     clearInterval(waitLoop);
  //     // read acknowledgement
  //     self.readackframe(function(ackbuff){
  //       if (!ackbuff){
  //         next(false);
  //       }
  //       next(true);
  //     });
  //   } else if (timer > timeout) {
  //     // Failure- timed out
  //     clearInterval(waitLoop);
  //     return false;
  //   } else {
  //     // Increase timeout timer
  //     timer +=10;
  //   }
  // }, 10);
  
  // Wait for chip to say it's ready!
  while (self.wirereadstatus() != PN532_I2C_READY) {
    if (timeout) {
      // console.log('timeout')
      timer+=10;
      if (timer > timeout) {
        // console.log("about to return false")
        return false;
      }
    }
    // console.log("sleeping");
    tessel.sleep(10);
  }

  // read acknowledgement
  self.readackframe(function(ackbuff){
    if (!ackbuff){
      next(false);
    }
    next(true);
  });
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

  setTimeout(function () {
    // I2C START
    // checksum = PN532_PREAMBLE + PN532_PREAMBLE + PN532_STARTCODE2; // 0 + 0 + FF
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
  }, 2);
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
  
  tessel.sleep(2); 

  this.read_registers([], numBytes+2, function(err, response){
    next(response);
  });
}


/**************************************************************************/
/*! 
    @brief  I2C Helper Functions Below
*/
/**************************************************************************/
RFID.prototype.read_registers = function (dataToWrite, bytesToRead, next)
{

  this.i2c.transfer(dataToWrite, bytesToRead, function (err, data) {
    next(err, data);
  });
}


// Write a single byte to the register.
RFID.prototype.write_register  = function (dataToWrite)
{
  return this.i2c.send(dataToWrite);
}

// Write a single byte to the register.
RFID.prototype.write_one_register = function (dataToWrite)
{
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

exports.RFID = RFID;
exports.connect = function (hardware, portBank) {
  return new RFID(hardware, portBank);
}