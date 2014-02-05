// datasheet: http://www.nxp.com/documents/short_data_sheet/PN532_C1_SDS.pdf
// user manual: http://www.nxp.com/documents/user_manual/141520.pdf

var tm = process.binding('tm');
var tessel = require('tessel');

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

var irq = tessel.port("A").gpio(3);
var nRST = tessel.port("A").gpio(2);
var i2c;

var packetBuffer = [];

function initialize(hardware, next) {
  nRST.output();
  nRST.low(); // toggle reset every time we initialize
  i2c = new hardware.I2C(PN532_I2C_ADDRESS);
	i2c.initialize();
  irq.input();
  nRST.high();

	getFirmwareVersion(function(firmware){
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
function getFirmwareVersion(next) {
  var response;

  console.log("Starting firmware check...");

  var commandBuffer = [PN532_COMMAND_GETFIRMWAREVERSION];
  console.log('about to look for ack')
  sendCommandCheckAck(commandBuffer, 1, function(ack){
    console.log('checked ack')
    if (!ack){
      return next(0);
    }

    wirereaddata(12, function (firmware){
      // console.log("FIRMWARE: ", firmware);
      // console.log("cleaned firmware: ", response);
      next(firmware);
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
function readPassiveTargetID(cardbaudrate, next) {
  var commandBuffer = [
    PN532_COMMAND_INLISTPASSIVETARGET,
    1,
    cardbaudrate
  ];
  
  sendCommandCheckAck(commandBuffer, 3, function(ack){
    if (!ack) {
      return next(0x0);
    }
     // Wait for a card to enter the field
    var status = PN532_I2C_BUSY;
    while (wirereadstatus() != PN532_I2C_READY)
    {
      tessel.sleep(10);
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

    // read data packet
    wirereaddata(20, function(response){
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

  });
}

/**************************************************************************/
/*! 
    @brief  Configures the SAM (Secure Access Module)
*/
/**************************************************************************/
function SAMConfig(next) {
  var commandBuffer = [
    PN532_COMMAND_SAMCONFIGURATION,
    0x01,
    0x14,
    0x01
  ];
  
  sendCommandCheckAck(commandBuffer, 4, function(ack){
    if (!ack){
      return next(false);
    } 
    // read data packet
    wirereaddata(8, function(response){
      next(response[6] == 0x15);
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
function sendCommandCheckAck(cmd, cmdlen, next) {

  var timer = 0;
  var timeout = 5;
  // write the command
  wiresendcommand(cmd, cmdlen);
  
  // Wait for chip to say its ready!
  while (wirereadstatus() != PN532_I2C_READY) {
    if (timeout) {
      console.log('timeout')
      timer+=10;
      if (timer > timeout)  
        return false;
    }
    tessel.sleep(10);
  }

  // read acknowledgement
  readackframe(function(ackbuff){
    if (!ackbuff){
      next(false);
    }
    next(true);
  })
}

/**************************************************************************/
/*! 
    @brief  Writes a command to the PN532, automatically inserting the
            preamble and required frame details (checksum, len, etc.)

    @param  cmd       Pointer to the command buffer
*/
/**************************************************************************/
function wiresendcommand(cmd, cmdlen) {
  var checksum;

  cmdlen++;


  tessel.sleep(2);     // or whatever the delay is for waking up the board

  // I2C START
  checksum = PN532_PREAMBLE + PN532_PREAMBLE + PN532_STARTCODE2;
  var sendCommand = [PN532_PREAMBLE, 
    PN532_PREAMBLE, 
    PN532_STARTCODE2, 
    cmdlen, 
    ~cmdlen + 1, 
    PN532_HOSTTOPN532];

  checksum += PN532_HOSTTOPN532;

  for (var i=0; i<cmdlen-1; i++) {
   sendCommand.push(cmd[i]);
   checksum += cmd[i];
  }

  sendCommand.push(~checksum);
  sendCommand.push(PN532_POSTAMBLE);
  write_register(sendCommand);
} 

/**************************************************************************/
/*! 
    @brief  Tries to read the PN532 ACK frame (not to be confused with 
	        the I2C ACK signal)
*/
/**************************************************************************/
function readackframe(next) {
  
   wirereaddata(6, function(ackbuff){
    next(ackbuff);
   });
}

function wirereadstatus() {
  console.log('reading wire')
	var x = irq.read();

	console.log("IRQ", x);

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
function wirereaddata(numBytes, next) {
  
  tessel.sleep(2); 

  read_registers([], numBytes+2, function(err, response){
    next(response);
  });
}


/**************************************************************************/
/*! 
    @brief  I2C Helper Functions Below
*/
/**************************************************************************/
function read_registers (dataToWrite, bytesToRead, next)
{

  i2c.transfer(dataToWrite, bytesToRead, function (err, data) {
    next(err, data);
  });
}


// Write a single byte to the register.
function write_register (dataToWrite)
{
  return i2c.send(dataToWrite);
}

// Write a single byte to the register.
function write_one_register (dataToWrite)
{
  return i2c.send([dataToWrite]);
}

exports.initialize = initialize;
exports.SAMConfig = SAMConfig;
exports.readPassiveTargetID = readPassiveTargetID;
// initialize();