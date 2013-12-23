var rfid = require("../");
var PN532_MIFARE_ISO14443A = 0x00;
console.log("test");

rfid.initialize();

rfid.SAMConfig();

var uid = rfid.readPassiveTargetID(PN532_MIFARE_ISO14443A);

console.log("uid", uid);