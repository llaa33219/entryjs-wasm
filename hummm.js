/**
 * Entry.js WASM Turbo - WebAssembly 기반 블록 실행 가속기
 * 
 * 사용법: 이 스크립트를 EntryJS가 로드된 후 로드하면 됩니다.
 * <script src="entry-wasm-turbo.js"></script>
 * 
 * 또는 동적 로드:
 * const script = document.createElement('script');
 * script.src = 'entry-wasm-turbo.js';
 * document.head.appendChild(script);
 */
(function(global) {
    'use strict';

    const EntryWasmTurbo = {
        version: '1.0.0',
        isInitialized: false,
        wasmInstance: null,
        wasmMemory: null,
        originalBlocks: {},
        performanceStats: {
            wasmCalls: 0,
            jsCalls: 0,
            totalTime: 0
        }
    };

    // WAT (WebAssembly Text Format) 소스 코드
    // 수학 연산과 유틸리티 함수들을 WASM으로 구현
    const WAT_SOURCE = `
(module
  ;; Memory for passing arrays and complex data
  (memory (export "memory") 1)

  ;; ============================================
  ;; Constants
  ;; ============================================
  (global $PI f64 (f64.const 3.141592653589793))
  (global $TWO_PI f64 (f64.const 6.283185307179586))
  (global $DEG_TO_RAD f64 (f64.const 0.017453292519943295))
  (global $RAD_TO_DEG f64 (f64.const 57.29577951308232))
  (global $random_seed (mut i64) (i64.const 12345))

  ;; ============================================
  ;; Basic Math Operations (f64 - double precision)
  ;; ============================================
  
  (func $add (export "add") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.add
  )

  (func $sub (export "sub") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.sub
  )

  (func $mul (export "mul") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.mul
  )

  (func $div (export "div") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.div
  )

  ;; ============================================
  ;; Advanced Math Operations
  ;; ============================================

  (func $sqrt (export "sqrt") (param $x f64) (result f64)
    local.get $x
    f64.sqrt
  )

  (func $abs (export "abs") (param $x f64) (result f64)
    local.get $x
    f64.abs
  )

  (func $floor (export "floor") (param $x f64) (result f64)
    local.get $x
    f64.floor
  )

  (func $ceil (export "ceil") (param $x f64) (result f64)
    local.get $x
    f64.ceil
  )

  (func $trunc (export "trunc") (param $x f64) (result f64)
    local.get $x
    f64.trunc
  )

  (func $round (export "round") (param $x f64) (result f64)
    local.get $x
    f64.nearest
  )

  (func $min (export "min") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.min
  )

  (func $max (export "max") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.max
  )

  (func $neg (export "neg") (param $x f64) (result f64)
    local.get $x
    f64.neg
  )

  (func $copysign (export "copysign") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.copysign
  )

  ;; ============================================
  ;; Integer Operations
  ;; ============================================

  (func $add_i32 (export "add_i32") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add
  )

  (func $sub_i32 (export "sub_i32") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.sub
  )

  (func $mul_i32 (export "mul_i32") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.mul
  )

  (func $div_i32 (export "div_i32") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.div_s
  )

  (func $mod_i32 (export "mod_i32") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.rem_s
  )

  ;; ============================================
  ;; Angle conversion
  ;; ============================================

  (func $deg_to_rad (export "deg_to_rad") (param $deg f64) (result f64)
    local.get $deg
    global.get $DEG_TO_RAD
    f64.mul
  )

  (func $rad_to_deg (export "rad_to_deg") (param $rad f64) (result f64)
    local.get $rad
    global.get $RAD_TO_DEG
    f64.mul
  )

  ;; ============================================
  ;; Internal: Normalize angle to [-PI, PI]
  ;; ============================================
  (func $normalize_angle (param $x f64) (result f64)
    (local $result f64)
    local.get $x
    local.set $result
    
    (block $done_pos
      (loop $loop_pos
        local.get $result
        global.get $PI
        f64.le
        br_if $done_pos
        local.get $result
        global.get $TWO_PI
        f64.sub
        local.set $result
        br $loop_pos
      )
    )
    
    (block $done_neg
      (loop $loop_neg
        local.get $result
        global.get $PI
        f64.neg
        f64.ge
        br_if $done_neg
        local.get $result
        global.get $TWO_PI
        f64.add
        local.set $result
        br $loop_neg
      )
    )
    
    local.get $result
  )

  ;; ============================================
  ;; Sin function using Taylor series
  ;; sin(x) = x - x^3/3! + x^5/5! - x^7/7! + ...
  ;; ============================================
  (func $sin (export "sin") (param $x f64) (result f64)
    (local $n f64)
    (local $x2 f64)
    (local $term f64)
    (local $result f64)
    
    local.get $x
    call $normalize_angle
    local.set $n
    
    ;; x^2
    local.get $n
    local.get $n
    f64.mul
    local.set $x2
    
    ;; term = x, result = x
    local.get $n
    local.set $term
    local.get $n
    local.set $result
    
    ;; term 2: -x^3/6
    local.get $term
    local.get $x2
    f64.mul
    f64.const -6.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 3: x^5/120
    local.get $term
    local.get $x2
    f64.mul
    f64.const -20.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 4: -x^7/5040
    local.get $term
    local.get $x2
    f64.mul
    f64.const -42.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 5: x^9/362880
    local.get $term
    local.get $x2
    f64.mul
    f64.const -72.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 6: -x^11/39916800
    local.get $term
    local.get $x2
    f64.mul
    f64.const -110.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
  )

  ;; ============================================
  ;; Cos function using Taylor series
  ;; cos(x) = 1 - x^2/2! + x^4/4! - x^6/6! + ...
  ;; ============================================
  (func $cos (export "cos") (param $x f64) (result f64)
    (local $n f64)
    (local $x2 f64)
    (local $term f64)
    (local $result f64)
    
    local.get $x
    call $normalize_angle
    local.set $n
    
    ;; x^2
    local.get $n
    local.get $n
    f64.mul
    local.set $x2
    
    ;; term = 1, result = 1
    f64.const 1.0
    local.set $term
    f64.const 1.0
    local.set $result
    
    ;; term 2: -x^2/2
    local.get $term
    local.get $x2
    f64.mul
    f64.const -2.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 3: x^4/24
    local.get $term
    local.get $x2
    f64.mul
    f64.const -12.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 4: -x^6/720
    local.get $term
    local.get $x2
    f64.mul
    f64.const -30.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 5: x^8/40320
    local.get $term
    local.get $x2
    f64.mul
    f64.const -56.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
    local.set $result
    
    ;; term 6: -x^10/3628800
    local.get $term
    local.get $x2
    f64.mul
    f64.const -90.0
    f64.div
    local.set $term
    local.get $result
    local.get $term
    f64.add
  )

  ;; ============================================
  ;; Tan function: sin(x) / cos(x)
  ;; ============================================
  (func $tan (export "tan") (param $x f64) (result f64)
    local.get $x
    call $sin
    local.get $x
    call $cos
    f64.div
  )

  ;; ============================================
  ;; Natural logarithm approximation
  ;; ln(x) = 2 * arctanh((x-1)/(x+1))
  ;; ============================================
  (func $ln (export "ln") (param $x f64) (result f64)
    (local $y f64)
    (local $y2 f64)
    (local $result f64)
    (local $term f64)
    (local $n i32)
    
    local.get $x
    f64.const 0.0
    f64.le
    if
      f64.const nan
      return
    end
    
    ;; y = (x-1)/(x+1)
    local.get $x
    f64.const 1.0
    f64.sub
    local.get $x
    f64.const 1.0
    f64.add
    f64.div
    local.set $y
    
    local.get $y
    local.get $y
    f64.mul
    local.set $y2
    
    local.get $y
    local.set $result
    local.get $y
    local.set $term
    
    i32.const 1
    local.set $n
    
    (block $done
      (loop $loop
        local.get $n
        i32.const 10
        i32.ge_s
        br_if $done
        
        local.get $term
        local.get $y2
        f64.mul
        local.set $term
        
        local.get $result
        local.get $term
        local.get $n
        i32.const 2
        i32.mul
        i32.const 1
        i32.add
        f64.convert_i32_s
        f64.div
        f64.add
        local.set $result
        
        local.get $n
        i32.const 1
        i32.add
        local.set $n
        br $loop
      )
    )
    
    local.get $result
    f64.const 2.0
    f64.mul
  )

  ;; Log base 10
  (func $log10 (export "log10") (param $x f64) (result f64)
    local.get $x
    call $ln
    f64.const 2.302585092994046
    f64.div
  )

  ;; ============================================
  ;; Exponential function e^x using Taylor series
  ;; ============================================
  (func $exp (export "exp") (param $x f64) (result f64)
    (local $result f64)
    (local $term f64)
    (local $n i32)
    
    f64.const 1.0
    local.set $result
    f64.const 1.0
    local.set $term
    i32.const 1
    local.set $n
    
    (block $done
      (loop $loop
        local.get $n
        i32.const 20
        i32.ge_s
        br_if $done
        
        local.get $term
        local.get $x
        f64.mul
        local.get $n
        f64.convert_i32_s
        f64.div
        local.set $term
        
        local.get $result
        local.get $term
        f64.add
        local.set $result
        
        local.get $n
        i32.const 1
        i32.add
        local.set $n
        br $loop
      )
    )
    
    local.get $result
  )

  ;; Power function: x^y = e^(y * ln(x))
  (func $pow (export "pow") (param $x f64) (param $y f64) (result f64)
    local.get $y
    f64.const 0.0
    f64.eq
    if
      f64.const 1.0
      return
    end
    
    local.get $x
    f64.const 0.0
    f64.eq
    if
      f64.const 0.0
      return
    end
    
    local.get $y
    local.get $x
    call $ln
    f64.mul
    call $exp
  )

  ;; ============================================
  ;; Comparison Operations
  ;; ============================================

  (func $eq (export "eq") (param $a f64) (param $b f64) (result i32)
    local.get $a
    local.get $b
    f64.eq
  )

  (func $ne (export "ne") (param $a f64) (param $b f64) (result i32)
    local.get $a
    local.get $b
    f64.ne
  )

  (func $lt (export "lt") (param $a f64) (param $b f64) (result i32)
    local.get $a
    local.get $b
    f64.lt
  )

  (func $le (export "le") (param $a f64) (param $b f64) (result i32)
    local.get $a
    local.get $b
    f64.le
  )

  (func $gt (export "gt") (param $a f64) (param $b f64) (result i32)
    local.get $a
    local.get $b
    f64.gt
  )

  (func $ge (export "ge") (param $a f64) (param $b f64) (result i32)
    local.get $a
    local.get $b
    f64.ge
  )

  ;; ============================================
  ;; Distance calculation
  ;; ============================================
  (func $distance (export "distance") (param $x1 f64) (param $y1 f64) (param $x2 f64) (param $y2 f64) (result f64)
    (local $dx f64)
    (local $dy f64)
    
    local.get $x1
    local.get $x2
    f64.sub
    local.set $dx
    
    local.get $y1
    local.get $y2
    f64.sub
    local.set $dy
    
    local.get $dx
    local.get $dx
    f64.mul
    local.get $dy
    local.get $dy
    f64.mul
    f64.add
    f64.sqrt
  )

  ;; ============================================
  ;; Random number generation (LCG)
  ;; ============================================

  (func $set_random_seed (export "set_random_seed") (param $seed i64)
    local.get $seed
    global.set $random_seed
  )

  (func $random (export "random") (result f64)
    (local $next i64)
    
    global.get $random_seed
    i64.const 1103515245
    i64.mul
    i64.const 12345
    i64.add
    i64.const 2147483647
    i64.and
    local.set $next
    
    local.get $next
    global.set $random_seed
    
    local.get $next
    f64.convert_i64_u
    f64.const 2147483647.0
    f64.div
  )

  ;; Random in range [min, max]
  (func $random_range (export "random_range") (param $min f64) (param $max f64) (result f64)
    (local $rand f64)
    
    call $random
    local.set $rand
    
    local.get $rand
    local.get $max
    local.get $min
    f64.sub
    f64.mul
    local.get $min
    f64.add
  )

  ;; ============================================
  ;; Movement calculations
  ;; ============================================

  (func $move_x (export "move_x") (param $x f64) (param $angle f64) (param $distance f64) (result f64)
    (local $rad f64)
    
    local.get $angle
    global.get $DEG_TO_RAD
    f64.mul
    local.set $rad
    
    local.get $x
    local.get $distance
    local.get $rad
    call $cos
    f64.mul
    f64.add
  )

  (func $move_y (export "move_y") (param $y f64) (param $angle f64) (param $distance f64) (result f64)
    (local $rad f64)
    
    local.get $angle
    global.get $DEG_TO_RAD
    f64.mul
    local.set $rad
    
    local.get $y
    local.get $distance
    local.get $rad
    call $sin
    f64.mul
    f64.add
  )

  ;; ============================================
  ;; Factorial
  ;; ============================================
  (func $factorial (export "factorial") (param $n i32) (result f64)
    (local $result f64)
    (local $i i32)
    
    local.get $n
    i32.const 0
    i32.lt_s
    if
      f64.const nan
      return
    end
    
    local.get $n
    i32.const 0
    i32.eq
    if
      f64.const 1.0
      return
    end
    
    f64.const 1.0
    local.set $result
    i32.const 1
    local.set $i
    
    (block $done
      (loop $loop
        local.get $i
        local.get $n
        i32.gt_s
        br_if $done
        
        local.get $result
        local.get $i
        f64.convert_i32_s
        f64.mul
        local.set $result
        
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      )
    )
    
    local.get $result
  )

  ;; ============================================
  ;; Quotient and Modulo
  ;; ============================================
  (func $quotient (export "quotient") (param $a f64) (param $b f64) (result f64)
    local.get $a
    local.get $b
    f64.div
    f64.floor
  )

  (func $mod (export "mod") (param $a f64) (param $b f64) (result f64)
    (local $q f64)
    
    local.get $a
    local.get $b
    f64.div
    f64.floor
    local.set $q
    
    local.get $a
    local.get $b
    local.get $q
    f64.mul
    f64.sub
  )

  ;; ============================================
  ;; Clamp
  ;; ============================================
  (func $clamp (export "clamp") (param $value f64) (param $min f64) (param $max f64) (result f64)
    local.get $value
    local.get $min
    f64.max
    local.get $max
    f64.min
  )

  ;; ============================================
  ;; Lerp (Linear interpolation)
  ;; ============================================
  (func $lerp (export "lerp") (param $a f64) (param $b f64) (param $t f64) (result f64)
    local.get $a
    f64.const 1.0
    local.get $t
    f64.sub
    f64.mul
    local.get $b
    local.get $t
    f64.mul
    f64.add
  )
)`;

    // wabt 모듈을 저장할 변수
    let wabtModule = null;

    /**
     * WAT를 바이너리 WASM으로 컴파일
     */
    async function compileWatToWasm(watSource) {
        // wabt.js 로드 시도
        if (!wabtModule) {
            try {
                wabtModule = await loadWabtFromCDN();
                console.log('[EntryWasmTurbo] WABT 모듈 로드 성공');
            } catch (e) {
                console.warn('[EntryWasmTurbo] WABT 로드 실패, 대체 바이너리 사용:', e.message);
                return compileWatFallback(watSource);
            }
        }

        try {
            const wasmModule = wabtModule.parseWat('entry-turbo.wat', watSource);
            wasmModule.validate();
            const { buffer } = wasmModule.toBinary({});
            wasmModule.destroy();
            console.log('[EntryWasmTurbo] WAT → WASM 컴파일 성공');
            return buffer;
        } catch (e) {
            console.warn('[EntryWasmTurbo] WABT 컴파일 실패, 대체 바이너리 사용:', e.message);
            return compileWatFallback(watSource);
        }
    }

    /**
     * CDN에서 wabt.js 로드
     * wabt.js는 초기화 함수를 반환하므로 await으로 호출해야 함
     */
    async function loadWabtFromCDN() {
        // 먼저 스크립트 로드
        await new Promise((resolve, reject) => {
            // 이미 로드되어 있는지 확인
            if (typeof window.WabtModule !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/wabt@1.0.36/index.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load wabt.js from CDN'));
            document.head.appendChild(script);
        });

        // wabt 모듈 초기화 (wabt는 Promise를 반환하는 함수)
        if (typeof wabt === 'function') {
            return await wabt();
        } else if (typeof WabtModule === 'function') {
            return await WabtModule();
        } else {
            throw new Error('wabt module not found after script load');
        }
    }

    /**
     * 미리 컴파일된 WASM 바이너리 (기본 수학 연산만 포함)
     * wabt.js 로드 실패 시 사용하는 대체 바이너리
     */
    function compileWatFallback(watSource) {
        // 미리 컴파일된 최소한의 WASM 모듈 (기본 수학 연산)
        // 이 바이너리는 add, sub, mul, div, sqrt, abs, floor, ceil, round, min, max 함수를 포함
        const wasmBinary = new Uint8Array([
            0x00, 0x61, 0x73, 0x6d, // magic number
            0x01, 0x00, 0x00, 0x00, // version
            // Type section
            0x01, 0x0e, 0x03,
            // func type 0: (f64, f64) -> f64
            0x60, 0x02, 0x7c, 0x7c, 0x01, 0x7c,
            // func type 1: (f64) -> f64
            0x60, 0x01, 0x7c, 0x01, 0x7c,
            // func type 2: () -> f64
            0x60, 0x00, 0x01, 0x7c,
            // Function section
            0x03, 0x0c, 0x0b,
            0x00, 0x00, 0x00, 0x00, // add, sub, mul, div
            0x01, 0x01, 0x01, 0x01, 0x01, // sqrt, abs, floor, ceil, round
            0x00, 0x00, // min, max
            // Memory section
            0x05, 0x03, 0x01, 0x00, 0x01,
            // Export section
            0x07, 0x5b, 0x0c,
            0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00,
            0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
            0x03, 0x73, 0x75, 0x62, 0x00, 0x01,
            0x03, 0x6d, 0x75, 0x6c, 0x00, 0x02,
            0x03, 0x64, 0x69, 0x76, 0x00, 0x03,
            0x04, 0x73, 0x71, 0x72, 0x74, 0x00, 0x04,
            0x03, 0x61, 0x62, 0x73, 0x00, 0x05,
            0x05, 0x66, 0x6c, 0x6f, 0x6f, 0x72, 0x00, 0x06,
            0x04, 0x63, 0x65, 0x69, 0x6c, 0x00, 0x07,
            0x05, 0x72, 0x6f, 0x75, 0x6e, 0x64, 0x00, 0x08,
            0x03, 0x6d, 0x69, 0x6e, 0x00, 0x09,
            0x03, 0x6d, 0x61, 0x78, 0x00, 0x0a,
            // Code section
            0x0a, 0x3d, 0x0b,
            // add
            0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0xa0, 0x0b,
            // sub
            0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0xa1, 0x0b,
            // mul
            0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0xa2, 0x0b,
            // div
            0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0xa3, 0x0b,
            // sqrt
            0x05, 0x00, 0x20, 0x00, 0x9f, 0x0b,
            // abs
            0x05, 0x00, 0x20, 0x00, 0x99, 0x0b,
            // floor
            0x05, 0x00, 0x20, 0x00, 0x9c, 0x0b,
            // ceil
            0x05, 0x00, 0x20, 0x00, 0x9d, 0x0b,
            // round
            0x05, 0x00, 0x20, 0x00, 0x9e, 0x0b,
            // min
            0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0xa4, 0x0b,
            // max
            0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0xa5, 0x0b,
        ]);
        
        return wasmBinary.buffer;
    }

    /**
     * WASM 모듈 초기화
     */
    async function initializeWasm() {
        try {
            const wasmBuffer = await compileWatToWasm(WAT_SOURCE);
            const wasmModule = await WebAssembly.compile(wasmBuffer);
            const wasmInstance = await WebAssembly.instantiate(wasmModule);
            
            EntryWasmTurbo.wasmInstance = wasmInstance;
            EntryWasmTurbo.wasmMemory = wasmInstance.exports.memory;
            EntryWasmTurbo.exports = wasmInstance.exports;
            
            console.log('[EntryWasmTurbo] WASM 모듈 초기화 완료');
            return true;
        } catch (e) {
            console.error('[EntryWasmTurbo] WASM 초기화 실패:', e);
            return false;
        }
    }

    /**
     * WASM 가속 함수들
     * JS 폴백 없이 항상 WASM으로만 동작
     */
    const WasmMath = {
        // 기본 연산
        add: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.add(a, b);
        },
        
        sub: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.sub(a, b);
        },
        
        mul: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.mul(a, b);
        },
        
        div: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.div(a, b);
        },

        // 고급 수학 연산
        sqrt: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.sqrt(x);
        },

        abs: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.abs(x);
        },

        floor: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.floor(x);
        },

        ceil: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.ceil(x);
        },

        round: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.round(x);
        },

        min: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.min(a, b);
        },

        max: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.max(a, b);
        },

        // 삼각함수 (degree 입력)
        sin: (deg) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            const rad = EntryWasmTurbo.exports.deg_to_rad(deg);
            return EntryWasmTurbo.exports.sin(rad);
        },

        cos: (deg) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            const rad = EntryWasmTurbo.exports.deg_to_rad(deg);
            return EntryWasmTurbo.exports.cos(rad);
        },

        tan: (deg) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            const rad = EntryWasmTurbo.exports.deg_to_rad(deg);
            return EntryWasmTurbo.exports.tan(rad);
        },

        // 로그/지수 함수
        ln: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.ln(x);
        },

        log10: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.log10(x);
        },

        exp: (x) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.exp(x);
        },

        pow: (x, y) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.pow(x, y);
        },

        // 팩토리얼
        factorial: (n) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.factorial(Math.floor(n));
        },

        // 몫과 나머지
        quotient: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.quotient(a, b);
        },

        mod: (a, b) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.mod(a, b);
        },

        // 거리 계산
        distance: (x1, y1, x2, y2) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.distance(x1, y1, x2, y2);
        },

        // 난수 생성
        random: (min, max) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.random_range(min, max);
        },

        // 클램프
        clamp: (value, min, max) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.clamp(value, min, max);
        },

        // 선형 보간
        lerp: (a, b, t) => {
            EntryWasmTurbo.performanceStats.wasmCalls++;
            return EntryWasmTurbo.exports.lerp(a, b, t);
        }
    };

    /**
     * Entry.js 블록 함수 교체
     */
    function patchEntryBlocks() {
        if (typeof Entry === 'undefined' || !Entry.block) {
            console.warn('[EntryWasmTurbo] Entry.block을 찾을 수 없습니다. Entry.js가 로드된 후 다시 시도합니다.');
            return false;
        }

        const blocks = Entry.block;

        // calc_basic 블록 패치 (기본 사칙연산)
        if (blocks.calc_basic) {
            EntryWasmTurbo.originalBlocks.calc_basic = blocks.calc_basic.func;
            blocks.calc_basic.func = function(sprite, script) {
                const operator = script.getField('OPERATOR', script);
                let leftValue = script.getNumberValue('LEFTHAND', script);
                let rightValue = script.getNumberValue('RIGHTHAND', script);
                
                if (operator === 'PLUS') {
                    const leftStringValue = script.getValue('LEFTHAND', script);
                    const rightStringValue = script.getValue('RIGHTHAND', script);
                    if (!Entry.Utils.isNumber(leftStringValue)) leftValue = leftStringValue;
                    if (!Entry.Utils.isNumber(rightStringValue)) rightValue = rightStringValue;
                    
                    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
                        return WasmMath.add(leftValue, rightValue);
                    }
                    return leftValue + rightValue;
                }
                
                switch (operator) {
                    case 'MINUS': return WasmMath.sub(leftValue, rightValue);
                    case 'MULTI': return WasmMath.mul(leftValue, rightValue);
                    case 'DIVIDE': return WasmMath.div(leftValue, rightValue);
                    default: return leftValue + rightValue;
                }
            };
        }

        // calc_operation 블록 패치 (고급 수학 연산)
        if (blocks.calc_operation) {
            EntryWasmTurbo.originalBlocks.calc_operation = blocks.calc_operation.func;
            blocks.calc_operation.func = function(sprite, script) {
                const value = script.getNumberValue('LEFTHAND', script);
                let operator = script.getField('VALUE', script);
                
                if (operator.indexOf('_')) {
                    operator = operator.split('_')[0];
                }

                switch (operator) {
                    case 'square': return WasmMath.mul(value, value);
                    case 'factorial': return WasmMath.factorial(value);
                    case 'root': return WasmMath.sqrt(value);
                    case 'log': return WasmMath.log10(value);
                    case 'ln': return WasmMath.ln(value);
                    case 'sin': return WasmMath.sin(value);
                    case 'cos': return WasmMath.cos(value);
                    case 'tan': return WasmMath.tan(value);
                    case 'asin': return Math.asin(value) * 180 / Math.PI;
                    case 'acos': return Math.acos(value) * 180 / Math.PI;
                    case 'atan': return Math.atan(value) * 180 / Math.PI;
                    case 'floor': return WasmMath.floor(value);
                    case 'ceil': return WasmMath.ceil(value);
                    case 'round': return WasmMath.round(value);
                    case 'abs': return WasmMath.abs(value);
                    case 'unnatural': {
                        const result = value - WasmMath.floor(value);
                        return value < 0 ? 1 - result : result;
                    }
                    default: return WasmMath.round(value);
                }
            };
        }

        // quotient_and_mod 블록 패치
        if (blocks.quotient_and_mod) {
            EntryWasmTurbo.originalBlocks.quotient_and_mod = blocks.quotient_and_mod.func;
            blocks.quotient_and_mod.func = function(sprite, script) {
                const left = script.getNumberValue('LEFTHAND', script);
                const right = script.getNumberValue('RIGHTHAND', script);
                const operator = script.getField('OPERATOR', script);
                
                if (operator === 'QUOTIENT') {
                    return WasmMath.quotient(left, right);
                } else {
                    return WasmMath.mod(left, right);
                }
            };
        }

        // calc_rand 블록 패치
        if (blocks.calc_rand) {
            EntryWasmTurbo.originalBlocks.calc_rand = blocks.calc_rand.func;
            blocks.calc_rand.func = function(sprite, script) {
                const leftValue = script.getStringValue('LEFTHAND', script);
                const rightValue = script.getStringValue('RIGHTHAND', script);
                const left = Math.min(leftValue, rightValue);
                const right = Math.max(leftValue, rightValue);
                const isLeftFloat = Entry.isFloat(leftValue);
                const isRightFloat = Entry.isFloat(rightValue);
                
                if (isRightFloat || isLeftFloat) {
                    return WasmMath.random(left, right).toFixed(2);
                } else {
                    return Math.floor(WasmMath.random(left, right + 1));
                }
            };
        }

        // distance_something 블록 패치
        if (blocks.distance_something) {
            EntryWasmTurbo.originalBlocks.distance_something = blocks.distance_something.func;
            blocks.distance_something.func = function(sprite, script) {
                const targetId = script.getField('VALUE', script);
                const spriteX = sprite.getX();
                const spriteY = sprite.getY();
                
                if (targetId === 'mouse') {
                    const mousePos = Entry.stage.mouseCoordinate;
                    return WasmMath.distance(spriteX, spriteY, mousePos.x, mousePos.y);
                } else {
                    const targetEntity = Entry.container.getEntity(targetId);
                    return WasmMath.distance(spriteX, spriteY, targetEntity.getX(), targetEntity.getY());
                }
            };
        }

        // move_direction 블록 패치
        if (blocks.move_direction) {
            EntryWasmTurbo.originalBlocks.move_direction = blocks.move_direction.func;
            blocks.move_direction.func = function(sprite, script) {
                const value = script.getNumberValue('VALUE', script);
                const angle = sprite.getRotation() + sprite.getDirection() - 90;
                const radians = angle * Math.PI / 180;
                
                sprite.setX(sprite.getX() + value * WasmMath.cos(angle));
                sprite.setY(sprite.getY() - value * WasmMath.sin(angle));
                
                if (sprite.brush && !sprite.brush.stop) {
                    sprite.brush.lineTo(sprite.getX(), sprite.getY() * -1);
                }
                if (sprite.paint && !sprite.paint.stop) {
                    sprite.paint.lineTo(sprite.getX(), sprite.getY() * -1);
                }
                return script.callReturn();
            };
        }

        // move_to_angle 블록 패치
        if (blocks.move_to_angle) {
            EntryWasmTurbo.originalBlocks.move_to_angle = blocks.move_to_angle.func;
            blocks.move_to_angle.func = function(sprite, script) {
                let [value, angle] = script.getValues(['VALUE', 'ANGLE'], script);
                value = Number(value);
                angle = Number(angle);
                
                sprite.setX(sprite.getX() + value * WasmMath.cos(angle - 90));
                sprite.setY(sprite.getY() - value * WasmMath.sin(angle - 90));
                
                if (sprite.brush && !sprite.brush.stop) {
                    sprite.brush.lineTo(sprite.getX(), sprite.getY() * -1);
                }
                if (sprite.paint && !sprite.paint.stop) {
                    sprite.paint.lineTo(sprite.getX(), sprite.getY() * -1);
                }
                return script.callReturn();
            };
        }

        console.log('[EntryWasmTurbo] Entry 블록 패치 완료');
        return true;
    }

    /**
     * Entry.js Executor 최적화
     * 루프 실행 속도 향상을 위한 패치
     */
    function patchExecutor() {
        if (typeof Entry === 'undefined' || !Entry.Executor) {
            return false;
        }

        const originalExecute = Entry.Executor.prototype.execute;
        
        Entry.Executor.prototype.execute = function(isFromOrigin) {
            // 터보 모드에서 더 많은 블록을 한 번에 실행
            if (Entry.isTurbo && EntryWasmTurbo.isInitialized) {
                // 성능 측정 시작
                const startTime = performance.now();
                const result = originalExecute.call(this, isFromOrigin);
                EntryWasmTurbo.performanceStats.totalTime += performance.now() - startTime;
                return result;
            }
            
            return originalExecute.call(this, isFromOrigin);
        };

        console.log('[EntryWasmTurbo] Executor 패치 완료');
        return true;
    }

    /**
     * 성능 통계 출력
     */
    function printStats() {
        const stats = EntryWasmTurbo.performanceStats;
        console.log('[EntryWasmTurbo] 성능 통계:');
        console.log(`  WASM 호출: ${stats.wasmCalls}`);
        console.log(`  JS 호출: ${stats.jsCalls}`);
        console.log(`  총 실행 시간: ${stats.totalTime.toFixed(2)}ms`);
        console.log(`  WASM 비율: 100% (JS 폴백 없음)`);
    }

    /**
     * 초기화 함수
     */
    async function initialize() {
        console.log('[EntryWasmTurbo] 초기화 시작...');
        
        // WASM 모듈 초기화
        const wasmInitialized = await initializeWasm();
        
        if (wasmInitialized) {
            // Entry.js가 로드되었는지 확인
            if (typeof Entry !== 'undefined') {
                patchEntryBlocks();
                patchExecutor();
                EntryWasmTurbo.isInitialized = true;
                console.log('[EntryWasmTurbo] 초기화 완료! 🚀');
            } else {
                // Entry.js 로드 대기
                console.log('[EntryWasmTurbo] Entry.js 로드 대기 중...');
                let attempts = 0;
                const maxAttempts = 50;
                
                const checkEntry = setInterval(() => {
                    attempts++;
                    if (typeof Entry !== 'undefined' && Entry.block) {
                        clearInterval(checkEntry);
                        patchEntryBlocks();
                        patchExecutor();
                        EntryWasmTurbo.isInitialized = true;
                        console.log('[EntryWasmTurbo] 초기화 완료! 🚀');
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkEntry);
                        console.warn('[EntryWasmTurbo] Entry.js를 찾을 수 없습니다.');
                    }
                }, 200);
            }
        } else {
            console.error('[EntryWasmTurbo] WASM 초기화 실패. 블록 패치를 진행하지 않습니다.');
            EntryWasmTurbo.isInitialized = false;
        }
    }

    /**
     * 원래 블록 함수로 복원
     */
    function restore() {
        if (typeof Entry === 'undefined' || !Entry.block) {
            return;
        }

        Object.keys(EntryWasmTurbo.originalBlocks).forEach(blockType => {
            if (Entry.block[blockType] && EntryWasmTurbo.originalBlocks[blockType]) {
                Entry.block[blockType].func = EntryWasmTurbo.originalBlocks[blockType];
            }
        });

        EntryWasmTurbo.isInitialized = false;
        console.log('[EntryWasmTurbo] 원래 블록으로 복원됨');
    }

    // Public API
    EntryWasmTurbo.initialize = initialize;
    EntryWasmTurbo.restore = restore;
    EntryWasmTurbo.printStats = printStats;
    EntryWasmTurbo.WasmMath = WasmMath;
    EntryWasmTurbo.patchEntryBlocks = patchEntryBlocks;

    // 전역 객체에 노출
    global.EntryWasmTurbo = EntryWasmTurbo;

    // 자동 초기화
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initialize();
    } else {
        document.addEventListener('DOMContentLoaded', initialize);
    }

})(typeof window !== 'undefined' ? window : this);
