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

//todos from Adafruit: read/write gpio, read/write card

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
    var wait = setInterval(function () {
      if (self.wirereadstatus() === PN532_I2C_READY) {
        clearInterval(wait);
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
        }, 10);
      }

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
    });
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
  
  // Wait for chip to say it's ready
  var timeoutLoop = setInterval(function () {
    if (self.wirereadstatus() != PN532_I2C_READY) {
      if (timeout) {
        timer+=10;
        if (timer > timeout) {
          console.log('Connection timed out. Try again?')
          return false;
        }
      }
    } else {
      // Ready! Continue:
      clearInterval(timeoutLoop);
      // read acknowledgement
      self.readackframe(function(ackbuff){
        if (!ackbuff){
          next(false);
        }
        next(true);
      });
    }
  }, 10);
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
  var self = this;

  setTimeout(function () {
    this.read_registers([], numBytes+2, function(err, response){
      next(response);
    });
  }, 2);
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

RFID.prototype.checkCardType = function (uid) {
  // Checks the type of RFID card.
  // The card we have included is the Mifare Classic 1k.

}

// /***** Mifare Classic Functions DIRECTLY from Adafruit https://github.com/adafruit/Adafruit-PN532/blob/master/Adafruit_PN532.cpp ******/

// /**************************************************************************/
// /*! 
//       Indicates whether the specified block number is the first block
//       in the sector (block 0 relative to the current sector)
// */
// /**************************************************************************/

// ** Translated from C++ **

RFID.prototype.mifareclassic_IsFirstBlock = function(uiBlock) {
  // Test if we are in the small or big sectors
  if (uiBlock < 128) {
    return ((uiBlock % 4) == 0);
  } else {
    return ((uiBlock % 16) == 0);
  }
}

// /**************************************************************************/
// /*! 
//       Indicates whether the specified block number is the sector trailer
// */
// /**************************************************************************/

// ** Translated from C++ **

RFID.prototype.mifareclassic_IsTrailerBlock = function(uiBlock) {
  // Test if we are in the small or big sectors
  if (uiBlock < 128) {
    return (((uiBlock + 1) % 4) == 0);
  } else {
    return (((uiBlock + 1) % 16) == 0);
  }
}

// /**************************************************************************/
// /*! 
//     Tries to authenticate a block of memory on a MIFARE card using the
//     INDATAEXCHANGE command.  See section 7.3.8 of the PN532 User Manual
//     for more information on sending MIFARE and other commands.

//     @param  uid           Pointer to a byte array containing the card UID
//     @param  uidLen        The length (in bytes) of the card's UID (Should
//                           be 4 for MIFARE Classic)
//     @param  blockNumber   The block number to authenticate.  (0..63 for
//                           1KB cards, and 0..255 for 4KB cards).
//     @param  keyNumber     Which key type to use during authentication
//                           (0 = MIFARE_CMD_AUTH_A, 1 = MIFARE_CMD_AUTH_B)
//     @param  keyData       Pointer to a byte array containing the 6 byte
//                           key value
    
//     @returns 1 if everything executed properly, 0 for an error
// */
// /**************************************************************************/

// ** Translated from C++ **

RFID.prototype.mifareclassic_AuthenticateBlock = function (uid, uidLen, blockNumber, keyNumber, keyData) {
  var len = new Number;
  var i = new Number;

  console.log("Trying to authenticate card...")

  // Prepare the authentication command
}
// uint8_t Adafruit_PN532::mifareclassic_AuthenticateBlock (uint8_t * uid, uint8_t uidLen, uint32_t blockNumber, uint8_t keyNumber, uint8_t * keyData)
// {
//   uint8_t len;
//   uint8_t i;
  
//   // Hang on to the key and uid data
//   memcpy (_key, keyData, 6); 
//   memcpy (_uid, uid, uidLen); 
//   _uidLen = uidLen;  

//   #ifdef MIFAREDEBUG
//   Serial.print("Trying to authenticate card ");
//   Adafruit_PN532::PrintHex(_uid, _uidLen);
//   Serial.print("Using authentication KEY ");Serial.print(keyNumber ? 'B' : 'A');Serial.print(": ");
//   Adafruit_PN532::PrintHex(_key, 6);
//   #endif
  
//   // Prepare the authentication command //
//   pn532_packetbuffer[0] = PN532_COMMAND_INDATAEXCHANGE;   /* Data Exchange Header */
//   pn532_packetbuffer[1] = 1;                              /* Max card numbers */
//   pn532_packetbuffer[2] = (keyNumber) ? MIFARE_CMD_AUTH_B : MIFARE_CMD_AUTH_A;
//   pn532_packetbuffer[3] = blockNumber;                    /* Block Number (1K = 0..63, 4K = 0..255 */
//   memcpy (pn532_packetbuffer+4, _key, 6);
//   for (i = 0; i < _uidLen; i++)
//   {
//     pn532_packetbuffer[10+i] = _uid[i];                /* 4 byte card ID */
//   }

//   if (! sendCommandCheckAck(pn532_packetbuffer, 10+_uidLen))
//     return 0;

//   // Read the response packet
//   readspidata(pn532_packetbuffer, 12);
//   // check if the response is valid and we are authenticated???
//   // for an auth success it should be bytes 5-7: 0xD5 0x41 0x00
//   // Mifare auth error is technically byte 7: 0x14 but anything other and 0x00 is not good
//   if (pn532_packetbuffer[7] != 0x00)
//   {
//     #ifdef PN532DEBUG
//     Serial.print("Authentification failed: ");
//     Adafruit_PN532::PrintHexChar(pn532_packetbuffer, 12);
//     #endif
//     return 0;
//   }

//   return 1;
// }

// /**************************************************************************/
// /*! 
//     Tries to read an entire 16-byte data block at the specified block
//     address.

//     @param  blockNumber   The block number to authenticate.  (0..63 for
//                           1KB cards, and 0..255 for 4KB cards).
//     @param  data          Pointer to the byte array that will hold the
//                           retrieved data (if any)
    
//     @returns 1 if everything executed properly, 0 for an error
// */
// /**************************************************************************/

RFID.prototype.mifareclassic_ReadDataBlock = function (blockNumber, data) {

}
// uint8_t Adafruit_PN532::mifareclassic_ReadDataBlock (uint8_t blockNumber, uint8_t * data)
// {
//   #ifdef MIFAREDEBUG
//   Serial.print("Trying to read 16 bytes from block ");Serial.println(blockNumber);
//   #endif
  
//   /* Prepare the command */
//   pn532_packetbuffer[0] = PN532_COMMAND_INDATAEXCHANGE;
//   pn532_packetbuffer[1] = 1;                      /* Card number */
//   pn532_packetbuffer[2] = MIFARE_CMD_READ;        /* Mifare Read command = 0x30 */
//   pn532_packetbuffer[3] = blockNumber;            /* Block Number (0..63 for 1K, 0..255 for 4K) */

//   /* Send the command */
//   if (! sendCommandCheckAck(pn532_packetbuffer, 4))
//   {
//     #ifdef MIFAREDEBUG
//     Serial.println("Failed to receive ACK for read command");
//     #endif
//     return 0;
//   }

//   /* Read the response packet */
//   readspidata(pn532_packetbuffer, 26);

//   /* If byte 8 isn't 0x00 we probably have an error */
//   if (pn532_packetbuffer[7] != 0x00)
//   {
//     //#ifdef MIFAREDEBUG
//     Serial.println("Unexpected response");
//     Adafruit_PN532::PrintHexChar(pn532_packetbuffer, 26);
//     //#endif
//     return 0;
//   }
    
//   /* Copy the 16 data bytes to the output buffer        */
//   /* Block content starts at byte 9 of a valid response */
//   memcpy (data, pn532_packetbuffer+8, 16);

//   /* Display data for debug if requested */
//   #ifdef MIFAREDEBUG
//     Serial.print("Block ");
//     Serial.println(blockNumber);
//     Adafruit_PN532::PrintHexChar(data, 16);
//   #endif

//   return 1;  
// }

// ************************************************************************
// /*! 
//     Tries to write an entire 16-byte data block at the specified block
//     address.

//     @param  blockNumber   The block number to authenticate.  (0..63 for
//                           1KB cards, and 0..255 for 4KB cards).
//     @param  data          The byte array that contains the data to write.
    
//     @returns 1 if everything executed properly, 0 for an error
// */
// /**************************************************************************/

RFID.prototype.mifareclassic_WriteDataBlock = function(blockNumber, data) {

}

// uint8_t Adafruit_PN532::mifareclassic_WriteDataBlock (uint8_t blockNumber, uint8_t * data)
// {
//   #ifdef MIFAREDEBUG
//   Serial.print("Trying to write 16 bytes to block ");Serial.println(blockNumber);
//   #endif
  
//   /* Prepare the first command */
//   pn532_packetbuffer[0] = PN532_COMMAND_INDATAEXCHANGE;
//   pn532_packetbuffer[1] = 1;                      /* Card number */
//   pn532_packetbuffer[2] = MIFARE_CMD_WRITE;       /* Mifare Write command = 0xA0 */
//   pn532_packetbuffer[3] = blockNumber;            /* Block Number (0..63 for 1K, 0..255 for 4K) */
//   memcpy (pn532_packetbuffer+4, data, 16);          /* Data Payload */

//   /* Send the command */
//   if (! sendCommandCheckAck(pn532_packetbuffer, 20))
//   {
//     #ifdef MIFAREDEBUG
//     Serial.println("Failed to receive ACK for write command");
//     #endif
//     return 0;
//   }  
//   delay(10);
  
//   /* Read the response packet */
//   readspidata(pn532_packetbuffer, 26);

//   return 1;  
// }

// /**************************************************************************/
// /*! 
//     Formats a Mifare Classic card to store NDEF Records 
    
//     @returns 1 if everything executed properly, 0 for an error
// */
// /**************************************************************************/

RFID.prototype.mifareclassic_FormatNDEF = function () {

}

// uint8_t Adafruit_PN532::mifareclassic_FormatNDEF (void)
// {
//   uint8_t sectorbuffer1[16] = {0x14, 0x01, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1};
//   uint8_t sectorbuffer2[16] = {0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1, 0x03, 0xE1};
//   uint8_t sectorbuffer3[16] = {0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0x78, 0x77, 0x88, 0xC1, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

//   // Write block 1 and 2 to the card
//   if (!(mifareclassic_WriteDataBlock (1, sectorbuffer1)))
//     return 0;
//   if (!(mifareclassic_WriteDataBlock (2, sectorbuffer2)))
//     return 0;
//   // Write key A and access rights card
//   if (!(mifareclassic_WriteDataBlock (3, sectorbuffer3)))
//     return 0;

//   // Seems that everything was OK (?!)
//   return 1;
// }

// /**************************************************************************/
// /*! 
//     Writes an NDEF URI Record to the specified sector (1..15)
    
//     Note that this function assumes that the Mifare Classic card is
//     already formatted to work as an "NFC Forum Tag" and uses a MAD1
//     file system.  You can use the NXP TagWriter app on Android to
//     properly format cards for this.

//     @param  sectorNumber  The sector that the URI record should be written
//                           to (can be 1..15 for a 1K card)
//     @param  uriIdentifier The uri identifier code (0 = none, 0x01 = 
//                           "http://www.", etc.)
//     @param  url           The uri text to write (max 38 characters).
    
//     @returns 1 if everything executed properly, 0 for an error
// */
// /**************************************************************************/

RFID.prototype.mifareclassic_WriteNDEFURI = function(sectorNumber,uriIdentifier, url) {
  
}

// uint8_t Adafruit_PN532::mifareclassic_WriteNDEFURI (uint8_t sectorNumber, uint8_t uriIdentifier, const char * url)
// {
//   // Figure out how long the string is
//   uint8_t len = strlen(url);
  
//   // Make sure we're within a 1K limit for the sector number
//   if ((sectorNumber < 1) || (sectorNumber > 15))
//     return 0;
  
//   // Make sure the URI payload is between 1 and 38 chars
//   if ((len < 1) || (len > 38))
//     return 0;
    
//   // Setup the sector buffer (w/pre-formatted TLV wrapper and NDEF message)
//   uint8_t sectorbuffer1[16] = {0x00, 0x00, 0x03, len+5, 0xD1, 0x01, len+1, 0x55, uriIdentifier, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
//   uint8_t sectorbuffer2[16] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
//   uint8_t sectorbuffer3[16] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
//   uint8_t sectorbuffer4[16] = {0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7, 0x7F, 0x07, 0x88, 0x40, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
//   if (len <= 6)
//   {
//     // Unlikely we'll get a url this short, but why not ...
//     memcpy (sectorbuffer1+9, url, len);
//     sectorbuffer1[len+9] = 0xFE;
//   }
//   else if (len == 7)
//   {
//     // 0xFE needs to be wrapped around to next block
//     memcpy (sectorbuffer1+9, url, len);
//     sectorbuffer2[0] = 0xFE;
//   }
//   else if ((len > 7) || (len <= 22))
//   {
//     // Url fits in two blocks
//     memcpy (sectorbuffer1+9, url, 7);
//     memcpy (sectorbuffer2, url+7, len-7);
//     sectorbuffer2[len-7] = 0xFE;
//   }
//   else if (len == 23)
//   {
//     // 0xFE needs to be wrapped around to final block
//     memcpy (sectorbuffer1+9, url, 7);
//     memcpy (sectorbuffer2, url+7, len-7);
//     sectorbuffer3[0] = 0xFE;
//   }
//   else
//   {
//     // Url fits in three blocks
//     memcpy (sectorbuffer1+9, url, 7);
//     memcpy (sectorbuffer2, url+7, 16);
//     memcpy (sectorbuffer3, url+23, len-24);
//     sectorbuffer3[len-22] = 0xFE;
//   }
  
//   // Now write all three blocks back to the card
//   if (!(mifareclassic_WriteDataBlock (sectorNumber*4, sectorbuffer1)))
//     return 0;
//   if (!(mifareclassic_WriteDataBlock ((sectorNumber*4)+1, sectorbuffer2)))
//     return 0;
//   if (!(mifareclassic_WriteDataBlock ((sectorNumber*4)+2, sectorbuffer3)))
//     return 0;
//   if (!(mifareclassic_WriteDataBlock ((sectorNumber*4)+3, sectorbuffer4)))
//     return 0;

//   // Seems that everything was OK (?!)
//   return 1;
// }

exports.RFID = RFID;
exports.connect = function (hardware, portBank) {
  return new RFID(hardware, portBank);
}