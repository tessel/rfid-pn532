#RFID
Driver for the rfid-pn532 Tessel RFID module ([PN532](http://www.adafruit.com/datasheets/pn532ds.pdf)).

##Installation
```sh
npm install rfid-pn532
```
##Example
```js
var rfid = require("rfid-pn532");
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
```

##Methods

*  **`rfid`.initialize(hardware, next)**

*  **`rfid`.readPassiveTargetID(cardbaudrate, next)**

## License

MIT
