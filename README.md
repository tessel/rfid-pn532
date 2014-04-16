#RFID
Driver for the rfid-pn532 Tessel RFID module ([PN532](http://www.adafruit.com/datasheets/pn532longds.pdf)).

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

Software License Agreement (BSD License)

Copyright (c) 2012, Adafruit Industries

Copyright (c) 2014, Technical Machine

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holders nor the
names of its contributors may be used to endorse or promote products
derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
