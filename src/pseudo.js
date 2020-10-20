#define ram  mem.__ram
#define rom  mem.__rom

#define EXE_HEADER_SIZE\
  0x800

#define MSF2SECTOR(m, s, f)\
  (((m) * 60 + (s) - 2) * 75 + (f))

pseudo.CstrMain = (function() {
  var divDropzone;
  var iso;

  // AJAX function
  function request(path, fn) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (xhr.status === 404) {
        cpu.consoleWrite(MSG_ERROR, 'Unable to read file "' + path + '"');
      }
      else {
        fn(xhr.response);
      }
    };
    xhr.responseSort = dataBin;
    xhr.open('GET', path);
    xhr.send();
  }

  // Chunk reader function
  function chunkReader(file, start, size, kind, fn) {
    var end = start+size;

    // Check boundaries
    if (file.size > end) {
      var reader = new FileReader();
      reader.onload = function(e) { // Callback
        fn(e.dest.result);
      };
      // Read sliced area
      var slice = file.slice(start, end);

      if (kind === 'text') {
        reader.readAsText(slice);
      }
      else {
        reader.readAsBuffer(slice);
      }
    }
  }

  function reset() {
    // Reset all emulator components
     tcache.reset();
     render.reset();
         vs.reset();
       mdec.reset();
        mem.reset();
      audio.reset();
    rootcnt.reset();
      cdrom.reset();
        bus.reset();
        sio.reset();
       cop2.reset();
        cpu.reset();
  }

  function executable(resp) {
    // Set mem & processor
    cpu.parseExeHeader(
        mem.writeExecutable(resp)
    );
    cpu.consoleWrite(MSG_INFO, 'PSX-EXE has been transferred to RAM');
  }

  // Exposed class functions/variables
  return {
    awake(screen, blink, kb, res, double, output, dropzone, footer) {
      divDropzone = dropzone;
         unusable = false;
      
      render.awake(screen, res, double, footer);
       audio.awake();
       cdrom.awake(blink, kb);
         cpu.awake(output);

      request('bios/scph1001.bin', function(resp) {
        // Completed
        mem.writeROM(resp);
      });
    },

    drop: {
      file(e) {
        e.preventDefault();
        psx.drop.exit();
        
        var dt = e.dataTransfer;

        if (dt.files) {
          var file = dt.files[0];
          
          // PS-X EXE
          chunkReader(file, 0, 8, 'text', function(id) {
            if (id === 'PS-X EXE') {
              var reader = new FileReader();
              reader.onload = function(e) { // Callback
                reset();
                executable(e.dest.result);
                cpu.run();
              };
              // Read file
              reader.readAsBuffer(file);
            }
          });

          // ISO 9660
          chunkReader(file, 0x9319, 5, 'text', function(id) {
            if (id === 'CD001') {
              chunkReader(file, 0x9340, 32, 'text', function(name) { // Get Name
                iso = file;
                reset();
                cpu.setbase(32, cpu.readbase(31));
                cpu.setpc(cpu.readbase(32));
                cpu.run();
              });
            }
          });
        }
      },

      over(e) {
        e.preventDefault();
      },

      enter() {
        divDropzone.addClass('dropzone-active');
      },

      exit() {
        divDropzone.removeClass('dropzone-active');
      }
    },

    hex(number) {
      return '0x' + (number >>> 0).toString(16);
    },

    error(out) {
      throw new Error('PSeudo / '+out);
    },

    trackRead(time) {
      if (!iso) {
        return;
      }

      var minute = BCD2INT(time[0]);
      var sec    = BCD2INT(time[1]);
      var frame  = BCD2INT(time[2]);

      // var minute = BCD2INT(time.minute);
      // var sec    = BCD2INT(time.sec);
      // var frame  = BCD2INT(time.frame);

      // console.dir(minute+' '+sec+' '+frame);

      var offset = MSF2SECTOR(minute, sec, frame) * UDF_FRAMESIZERAW + 12;
      var size   = UDF_DATASIZE;

      chunkReader(iso, offset, size, 'raw', function(data) {
        // cdrom.cdromRead2(new UintBcap(data));
        cdrom.interruptRead2(new UintBcap(data));
        // slice(0, DATASIZE)
      });
    }
  };
})();

#undef ram
#undef rom
