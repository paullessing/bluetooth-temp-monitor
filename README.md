# Bluetooth Temperature Monitor
Reverse-engineered interface for a [NICEAO Wireless Meat Thermometer](http://amzn.eu/d/1ZzsR2p).

Uses Bluetooth Low Energy to connect to the thermometer, reads the temperatures,
then posts them to a [Home Assistant](https://www.home-assistant.io) endpoint
for monitoring and alerting.

## Installation
```sh
# Compile the code
yarn install && yarn build

# Link the service definition to the system folder
ln -s installation/bluetooth-temp-monitor.service /etc/systemd/system/bluetooth-temp-monitor.service

# Reload the system list
sudo sustemctl daemon-reload

# Enable the service
sudo systemctl start bluetooth-temp-monitor

# Ensure it is running
sudo systemctl status bluetooth-temp-monitor
```

## Background
The NICEAO meat thermometer is a great thermometer that allows reading from up to 6 probes.
I use it for monitoring the internal and meat temperatures of my smoker.

The app is good, but it requires being within bluetooth range (which I am not always).
By setting up a Raspberry Pi with a BLE dongle within range, and having that connect to the WiFi,
I get much better range - *and* it connects to my Home assistant so I can tie it into all my automation.

## Reverse Engineering Process
1. Find the [app](https://play.google.com/store/apps/details?id=qlnet.com.easybbq)
2. Download it via [APKPure](https://apkpure.com/easybbq/qlnet.com.easybbq)
2. Decompile via [Java Decompilers](http://www.javadecompilers.com/apk)
