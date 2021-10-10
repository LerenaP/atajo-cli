const si = require('systeminformation');


class Device {

    constructor() {}

    getDevice(domain, lambda) {

        return new Promise(resolve => {

            si.getStaticData().then(device => {

                resolve({
                    uuid: device.system.uuid,
                    platform: device.os.platform,
                    version: device.versions.kernel,
                    manufacturer: device.system.manufacturer,
                    model: device.system.model,
                    cordova: 'N/A',
                    serial: device.system.serial,
                    network: device.net
                });
            });
        });
    }
}

/*
 { version: '3.25.1',
  system: 
   { manufacturer: 'Apple Inc.',
     model: 'MacBookPro11,1',
     version: '1.0',
     serial: 'C02N8KUHG3QH',
     uuid: 'D346820B-7020-5281-BF9F-FA56E6F20215' },
  os: 
   { platform: 'Darwin',
     distro: 'Mac OS X',
     release: '10.12.5',
     codename: '',
     kernel: '16.6.0',
     arch: 'x64',
     hostname: 'j1nx.local',
     logofile: 'apple' },
  versions: 
   { kernel: '16.6.0',
     node: '6.11.0',
     v8: '5.1.281.102',
     npm: '3.10.10',
     pm2: '',
     openssl: '1.0.2k' },
  cpu: 
   { manufacturer: 'Intel®',
     brand: 'Core™ i5-4278U',
     vendor: 'GenuineIntel',
     family: '6',
     model: '69',
     stepping: '1',
     revision: '',
     speed: '2.60',
     speedmin: '2.60',
     speedmax: '2.60',
     cores: 4,
     cache: { l1d: 32768, l1i: 32768, l2: 262144, l3: 3145728 },
     flags: 'fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clfsh ds acpi mmx fxsr sse sse2 ss htt tm pbe sse3 pclmulqdq dtes64 mon dscpl vmx est tm2 ssse3 fma cx16 tpr pdcm sse4.1 sse4.2 x2apic movbe popcnt aes pcid xsave osxsave seglim64 tsctmr avx1.0 rdrand f16c' },
  graphics: { controllers: [ [Object] ], displays: [ [Object] ] },
  net: 
   [ { iface: 'lo0',
       ip4: '127.0.0.1',
       ip6: 'fe80::1',
       mac: '00:00:00:00:00:00',
       internal: true },
     { iface: 'en0',
       ip4: '192.168.0.101',
       ip6: 'fe80::149f:6a31:39dc:3932',
       mac: '80:e6:50:14:f6:fc',
       internal: false },
     { iface: 'awdl0',
       ip4: '',
       ip6: 'fe80::a8fc:deff:fe96:641c',
       mac: 'aa:fc:de:96:64:1c',
       internal: false },
     { iface: 'utun0',
       ip4: '',
       ip6: 'fe80::b056:b9a1:1834:9774',
       mac: '00:00:00:00:00:00',
       internal: false } ],
  memLayout: 
   [ { size: 4294967296,
       bank: '',
       type: 'DDR3',
       clockSpeed: 1600,
       formFactor: '',
       partNum: '-',
       serialNum: '-',
       voltageConfigured: -1,
       voltageMin: -1,
       voltageMax: -1 },
     { size: 4294967296,
       bank: '',
       type: 'DDR3',
       clockSpeed: 1600,
       formFactor: '',
       partNum: '-',
       serialNum: '-',
       voltageConfigured: -1,
       voltageMin: -1,
       voltageMax: -1 } ],
  diskLayout: [] }
*/


module.exports = Device;