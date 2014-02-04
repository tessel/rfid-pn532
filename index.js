var rfid = require("./rfid");
var tessel = require('tessel');
var PN532_MIFARE_ISO14443A = 0x00;

var led1 = tessel.led(1).output().low();
var led2 = tessel.led(2).output().low();

rfid.initialize(tessel.port("A"), function(firmware){
  console.log('firmware initialized')
  rfid.SAMConfig(function(config){
    led1.high();

    console.log("Done with config");
     setImmediate(function loop () {
      led2.low();
      console.log("starting passive read");
      rfid.readPassiveTargetID(PN532_MIFARE_ISO14443A, function(uid){
        console.log("uid", uid);
        led2.high();
        setTimeout(loop, 200);
      });
    });
  });
});
