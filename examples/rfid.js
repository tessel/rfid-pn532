/*********************************************
RFID example
*********************************************/

var tessel = require('tessel');
console.log('Connecting...')
var rfid = require("../").connect(tessel.port("A"));

var PN532_MIFARE_ISO14443A = 0x00;

var led1 = tessel.led(1).output().low();
var led2 = tessel.led(2).output().low();

// Initialize RFID
console.log('Initializing...')
rfid.initialize(tessel.port("A"), function() {
  led1.high();
  console.log("Ready to read RFID card");
  rfid.on('data', function (uid) {
    led2.high();
    console.log(uid)
    led2.low();
  });
});