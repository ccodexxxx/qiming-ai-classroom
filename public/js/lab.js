/*!
 * lab.js —— 编程实践客户端
 *   1) 积木走迷宫：点积木搭程序，机器人按程序走，右侧实时翻译成 Python
 *   2) Python 迷你解释器：支持 print/变量/运算/条件/循环/函数/列表/字符串/绘图
 *   3) JavaScript 沙箱：同样的绘图 API
 *   4) AI 实践任务卡
 */
(function (global) {
  'use strict';
  var AIQ = global.AIQ;
  if (!AIQ) return;
  var el = AIQ.el, qs = AIQ.qs, api = AIQ.api;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ================= 朗读器 =================
   * 低幼学段的孩子还不识字，光有文字提示等于没有提示。
   * 这里用浏览器自带的语音合成，零素材、零依赖。
   * 只念「短句」——撞墙提示、通关祝贺、关卡目标，不念长段文字。
   */
  var Say = (function () {
    var ok = typeof global.speechSynthesis !== 'undefined' && typeof global.SpeechSynthesisUtterance !== 'undefined';
    var voice = null, on = true;
    function pick() {
      if (!ok) return;
      var list = global.speechSynthesis.getVoices() || [];
      var cn = list.filter(function (v) { return /zh[-_]?CN/i.test(v.lang); });
      voice = cn.filter(function (v) { return /female|女|Xiaoxiao|Huihui|Yaoyao|Tingting/i.test(v.name); })[0] || cn[0] || null;
    }
    if (ok) {
      pick();
      if (typeof global.speechSynthesis.addEventListener === 'function') {
        global.speechSynthesis.addEventListener('voiceschanged', pick);
      }
    }
    return {
      supported: ok,
      setEnabled: function (v) { on = !!v; if (!on) { try { global.speechSynthesis.cancel(); } catch (e) {} } },
      isEnabled: function () { return on; },
      say: function (text) {
        if (!ok || !on || !text) return false;
        try { global.speechSynthesis.cancel(); } catch (e) {}
        var u = new global.SpeechSynthesisUtterance(String(text).replace(/[「」]/g, ''));
        u.lang = 'zh-CN';
        u.rate = 0.92;      /* 比正常稍慢，方便孩子跟上 */
        u.pitch = 1.25;     /* 稍高的音调更亲切 */
        if (voice) u.voice = voice;
        try { global.speechSynthesis.speak(u); return true; } catch (e) { return false; }
      },
      stop: function () { if (ok) { try { global.speechSynthesis.cancel(); } catch (e) {} } }
    };
  })();

  /* ================================================================
   * 一、迷你 Python 解释器（教学用子集）
   * ================================================================ */
  var MiniPy = (function () {
    function Interp(opt) {
      this.out = [];
      this.vars = Object.create(null);
      this.steps = 0;
      this.maxSteps = (opt && opt.maxSteps) || 4000;
      this.startTime = Date.now();
      this.maxMs = (opt && opt.maxMs) || 2500;
      this.ctx = (opt && opt.ctx) || null;   // 绘图上下文
      this.funcs = Object.create(null);
      this.depth = 0;
      this.maxDepth = 40;
      this.builtins = this.makeBuiltins();
    }
    Interp.prototype.tick = function (line) {
      this.steps++;
      if (this.steps > this.maxSteps) throw this.err('程序运行的步骤太多，可能写成了死循环', line);
      if (Date.now() - this.startTime > this.maxMs) throw this.err('程序运行时间太长，可能写成了死循环', line);
    };
    Interp.prototype.err = function (msg, line) {
      var e = new Error(msg + (line ? '（第 ' + line + ' 行）' : ''));
      e.isMiniPy = true;
      e.line = line;
      return e;
    };
    Interp.prototype.log = function (s) { this.out.push(String(s)); };
    Interp.prototype.makeBuiltins = function () {
      var self = this;
      return {
        print: function () {
          var parts = Array.prototype.slice.call(arguments).map(function (v) { return self.show(v); });
          self.log(parts.join(' '));
          return null;
        },
        len: function (v) { return v && v.length !== undefined ? v.length : 0; },
        range: function (a, b, c) {
          var start = 0, stop = a, step = 1;
          if (b !== undefined) { start = a; stop = b; }
          if (c !== undefined) step = c;
          if (step === 0) throw self.err('range 的步长不能是 0');
          if (Math.abs((stop - start) / step) > 10000) throw self.err('range 的范围太大了');
          var out = [];
          if (step > 0) for (var i = start; i < stop; i += step) out.push(i);
          else for (var j = start; j > stop; j += step) out.push(j);
          return out;
        },
        str: function (v) { return self.show(v); },
        int: function (v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; },
        float: function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; },
        abs: Math.abs,
        round: function (v, digits) {
          var d = digits === undefined ? 0 : Number(digits);
          var f = Math.pow(10, d);
          return Math.round(Number(v) * f) / f;
        },
        min: function () { return Math.min.apply(null, flatten(arguments)); },
        max: function () { return Math.max.apply(null, flatten(arguments)); },
        sum: function (v) { return (v || []).reduce(function (a, b) { return a + b; }, 0); },
        sorted: function (v) { return (v || []).slice().sort(function (a, b) { return a - b; }); },
        sqrt: Math.sqrt,
        random: function () { var r = Math.random(); self.log('> 随机数 ' + r.toFixed(3)); return r; },
        randint: function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
        /* 绘图 API */
        moveTo: function (x, y) { if (self.ctx) self.ctx.moveTo(x, y); return null; },
        lineTo: function (x, y) { if (self.ctx) self.ctx.lineTo(x, y); return null; },
        circle: function (x, y, r) { if (self.ctx) self.ctx.circle(x, y, r); return null; },
        rect: function (x, y, w, h) { if (self.ctx) self.ctx.rect(x, y, w, h); return null; },
        penColor: function (c) { if (self.ctx) self.ctx.penColor(c); return null; },
        penSize: function (n) { if (self.ctx) self.ctx.penSize(n); return null; },
        clear: function () { if (self.ctx) self.ctx.clear(); return null; }
      };
    };
    function flatten(args) {
      var out = [];
      Array.prototype.slice.call(args).forEach(function (a) {
        if (Array.isArray(a)) out = out.concat(a); else out.push(a);
      });
      return out;
    }
    Interp.prototype.show = function (v) {
      if (v === null || v === undefined) return 'None';
      if (typeof v === 'boolean') return v ? 'True' : 'False';
      if (Array.isArray(v)) {
        var self = this;
        return '[' + v.map(function (x) { return typeof x === 'string' ? "'" + x + "'" : self.show(x); }).join(', ') + ']';
      }
      return String(v);
    };

    /* ---- 词法：把一行切成记号 ---- */
    function tokenize(line) {
      var tokens = [], i = 0;
      var re = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\d+\.\d+|\d+)|([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)|(\*\*|\/\/|==|!=|<=|>=|[+\-*/%<>=])|([()\[\],.:]))/y;
      while (i < line.length) {
        re.lastIndex = i;
        var m = re.exec(line);
        if (!m) {
          if (/^\s*$/.test(line.slice(i))) break;
          throw new Error('看不懂这一行的内容：「' + line.slice(i).trim() + '」');
        }
        if (m[1]) tokens.push({ t: 'str', v: unquote(m[1]) });
        else if (m[2]) tokens.push({ t: 'num', v: m[2].indexOf('.') >= 0 ? parseFloat(m[2]) : parseInt(m[2], 10) });
        else if (m[3]) tokens.push({ t: 'name', v: m[3] });
        else if (m[4]) tokens.push({ t: 'op', v: m[4] });
        else if (m[5]) tokens.push({ t: 'punc', v: m[5] });
        i = re.lastIndex;
      }
      return tokens;
    }
    function unquote(s) {
      var body = s.slice(1, -1);
      return body.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    }

    /* ---- 表达式求值（递归下降） ---- */
    function Parser(tokens, interp, line) {
      this.tk = tokens; this.i = 0; this.interp = interp; this.line = line;
    }
    Parser.prototype.peek = function () { return this.tk[this.i]; };
    Parser.prototype.next = function () { return this.tk[this.i++]; };
    Parser.prototype.expect = function (v) {
      var t = this.next();
      if (!t || t.v !== v) throw this.interp.err('这里少了一个「' + v + '」', this.line);
      return t;
    };
    Parser.prototype.atEnd = function () { return this.i >= this.tk.length; };
    Parser.prototype.parseExpr = function () { return this.parseOr(); };
    Parser.prototype.parseOr = function () {
      var left = this.parseAnd();
      while (this.peek() && this.peek().v === 'or') { this.next(); left = truthy(left) ? left : this.parseAnd(); }
      return left;
    };
    Parser.prototype.parseAnd = function () {
      var left = this.parseNot();
      while (this.peek() && this.peek().v === 'and') { this.next(); left = truthy(left) ? this.parseNot() : left; }
      return left;
    };
    Parser.prototype.parseNot = function () {
      if (this.peek() && this.peek().v === 'not') { this.next(); return !truthy(this.parseNot()); }
      return this.parseCmp();
    };
    Parser.prototype.parseCmp = function () {
      var left = this.parseAdd();
      var ops = ['==', '!=', '<', '<=', '>', '>=', 'in'];
      while (this.peek() && ops.indexOf(this.peek().v) >= 0) {
        var op = this.next().v;
        var right = this.parseAdd();
        if (op === '==') left = left === right || (typeof left === 'number' && typeof right === 'number' && left === right);
        else if (op === '!=') left = left !== right;
        else if (op === '<') left = left < right;
        else if (op === '<=') left = left <= right;
        else if (op === '>') left = left > right;
        else if (op === '>=') left = left >= right;
        else if (op === 'in') left = Array.isArray(right) ? right.indexOf(left) >= 0 : String(right).indexOf(String(left)) >= 0;
      }
      return left;
    };
    Parser.prototype.parseAdd = function () {
      var left = this.parseMul();
      while (this.peek() && (this.peek().v === '+' || this.peek().v === '-')) {
        var op = this.next().v;
        var right = this.parseMul();
        if (op === '+') {
          if (Array.isArray(left)) left = left.concat(right);
          else if (typeof left === 'string' || typeof right === 'string') left = this.interp.show(left) + this.interp.show(right);
          else left = left + right;
        } else {
          if (typeof left === 'string' || typeof right === 'string') {
            throw this.interp.err('不能把字符串当数字做减法', this.line);
          }
          left = left - right;
        }
      }
      return left;
    };
    Parser.prototype.parseMul = function () {
      var left = this.parseUnary();
      while (this.peek() && ['*', '/', '//', '%', '**'].indexOf(this.peek().v) >= 0) {
        var op = this.next().v;
        var right = this.parseUnary();
        if (op === '*') {
          if (typeof left === 'string') left = new Array(Math.max(0, right) + 1).join(left);
          else left = left * right;
        } else if (op === '/') {
          if (right === 0) throw this.interp.err('不能除以 0', this.line);
          left = left / right;
        } else if (op === '//') {
          if (right === 0) throw this.interp.err('不能除以 0', this.line);
          left = Math.floor(left / right);
        } else if (op === '%') left = left % right;
        else left = Math.pow(left, right);
      }
      return left;
    };
    Parser.prototype.parseUnary = function () {
      if (this.peek() && this.peek().v === '-') { this.next(); return -this.parseUnary(); }
      if (this.peek() && this.peek().v === '+') { this.next(); return this.parseUnary(); }
      return this.parsePower();
    };
    /* 幂运算比一元负号结合得更紧，且右结合：2 ** 3 ** 2 = 2 ** 9 */
    Parser.prototype.parsePower = function () {
      var base = this.parsePostfix();
      if (this.peek() && this.peek().v === '**') {
        this.next();
        return Math.pow(base, this.parseUnary());
      }
      return base;
    };
    Parser.prototype.parsePostfix = function () {
      var v = this.parseAtom();
      for (;;) {
        var t = this.peek();
        if (!t) break;
        if (t.v === '(') {
          this.next();
          var args = [];
          if (!(this.peek() && this.peek().v === ')')) {
            args.push(this.parseExpr());
            while (this.peek() && this.peek().v === ',') { this.next(); args.push(this.parseExpr()); }
          }
          this.expect(')');
          v = this.call(v, args);
        } else if (t.v === '[') {
          this.next();
          var idx = this.parseExpr();
          this.expect(']');
          v = this.index(v, idx);
        } else if (t.v === '.') {
          this.next();
          var name = this.next();
          if (!name) throw this.interp.err('点号后面要跟属性名', this.line);
          if (!(this.peek() && this.peek().v === '(')) {
            v = this.attr(v, name.v);
          } else {
            this.next();
            var a2 = [];
            if (!(this.peek() && this.peek().v === ')')) {
              a2.push(this.parseExpr());
              while (this.peek() && this.peek().v === ',') { this.next(); a2.push(this.parseExpr()); }
            }
            this.expect(')');
            v = this.method(v, name.v, a2);
          }
        } else break;
      }
      return v;
    };
    Parser.prototype.parseAtom = function () {
      var t = this.next();
      if (!t) throw this.interp.err('表达式不完整', this.line);
      if (t.t === 'num' || t.t === 'str') return t.v;
      if (t.v === '(') { var v = this.parseExpr(); this.expect(')'); return v; }
      if (t.v === '[') {
        var arr = [];
        if (!(this.peek() && this.peek().v === ']')) {
          arr.push(this.parseExpr());
          while (this.peek() && this.peek().v === ',') { this.next(); arr.push(this.parseExpr()); }
        }
        this.expect(']');
        return arr;
      }
      if (t.t === 'name') {
        if (t.v === 'True') return true;
        if (t.v === 'False') return false;
        if (t.v === 'None') return null;
        if (Object.prototype.hasOwnProperty.call(this.interp.vars, t.v)) return this.interp.vars[t.v];
        if (this.interp.builtins[t.v]) return t.v;   // 内置函数名，交给 call 处理
        if (this.interp.funcs[t.v]) return t.v;
        throw this.interp.err('还没有定义「' + t.v + '」这个名字', this.line);
      }
      throw this.interp.err('看不懂「' + t.v + '」', this.line);
    };
    Parser.prototype.call = function (fn, args) {
      if (typeof fn === 'function') return fn.apply(null, args);
      if (typeof fn === 'string') {
        if (this.interp.builtins[fn]) return this.interp.builtins[fn].apply(null, args);
        if (this.interp.funcs[fn]) return this.interp.callUser(fn, args, this.line);
      }
      throw this.interp.err('这个不是可以调用的函数', this.line);
    };
    Parser.prototype.index = function (obj, idx) {
      if (Array.isArray(obj)) {
        if (typeof idx !== 'number') throw this.interp.err('列表下标必须是数字', this.line);
        var i = idx < 0 ? obj.length + idx : idx;
        if (i < 0 || i >= obj.length) throw this.interp.err('下标 ' + idx + ' 超出范围了（列表长度 ' + obj.length + '）', this.line);
        return obj[i];
      }
      if (typeof obj === 'string') {
        var j = idx < 0 ? obj.length + idx : idx;
        if (j < 0 || j >= obj.length) throw this.interp.err('下标超出范围了', this.line);
        return obj[j];
      }
      throw this.interp.err('只有列表和字符串可以用下标', this.line);
    };
    Parser.prototype.attr = function (obj, name) {
      if (name === 'length') return obj && obj.length;
      throw this.interp.err('不支持读取属性「' + name + '」', this.line);
    };
    Parser.prototype.method = function (obj, name, args) {
      if (typeof obj === 'string') {
        if (name === 'upper') return obj.toUpperCase();
        if (name === 'lower') return obj.toLowerCase();
        if (name === 'strip') return obj.trim();
        if (name === 'split') return obj.split(args[0] === undefined ? ' ' : args[0]);
        if (name === 'replace') return obj.split(args[0]).join(args[1]);
        if (name === 'startswith') return obj.indexOf(args[0]) === 0;
        if (name === 'endswith') return obj.lastIndexOf(args[0]) === obj.length - args[0].length;
        if (name === 'find') return obj.indexOf(args[0]);
      }
      if (Array.isArray(obj)) {
        if (name === 'append') { obj.push(args[0]); return null; }
        if (name === 'pop') return obj.pop();
        if (name === 'insert') { obj.splice(args[0], 0, args[1]); return null; }
        if (name === 'sort') { obj.sort(function (a, b) { return a - b; }); return null; }
        if (name === 'reverse') { obj.reverse(); return null; }
        if (name === 'index') return obj.indexOf(args[0]);
        if (name === 'count') return obj.filter(function (x) { return x === args[0]; }).length;
      }
      throw this.interp.err('不支持方法「.' + name + '()」', this.line);
    };
    function truthy(v) { return !(v === false || v === 0 || v === '' || v === null || v === undefined); }

    /* ---- 解释执行 ---- */
    Interp.prototype.callUser = function (name, args, line) {
      var f = this.funcs[name];
      this.depth++;
      if (this.depth > this.maxDepth) throw this.err('函数调用层数太深了（可能没有终止条件）', line);
      var saved = {};
      f.params.forEach(function (p, i) { saved[p] = this.vars[p]; this.vars[p] = args[i]; }, this);
      var ret = null;
      try { this.execBlock(f.body, f.baseIndent); ret = this.__ret; this.__ret = undefined; }
      finally {
        f.params.forEach(function (p) { if (saved[p] === undefined) delete this.vars[p]; else this.vars[p] = saved[p]; }, this);
        this.depth--;
      }
      return ret;
    };

    /** 执行一段语句（含缩进块） */
    Interp.prototype.execBlock = function (lines, indent) {
      var i = 0;
      while (i < lines.length) {
        var raw = lines[i];
        var text = raw.text;
        var ind = raw.indent;
        if (!text.trim() || text.trim().indexOf('#') === 0) { i++; continue; }
        if (ind < indent) return i;               // 块结束
        if (ind > indent) throw this.err('这一行的缩进不对，多了空格', raw.no);
        var consumed = this.execStatement(lines, i, indent);
        i = consumed;
        if (this.__break || this.__continue || this.__ret !== undefined) return i;
      }
      return i;
    };

    Interp.prototype.execStatement = function (lines, i, indent) {
      var raw = lines[i];
      var text = raw.text.trim();
      var line = raw.no;
      this.tick(line);

      /* 块语句检查：必须以冒号结尾，且下面要有缩进的代码 */
      if (/^(if|elif|else|for|while|def)\b/.test(text) && !/:\s*$/.test(text)) {
        throw this.err('这一行的最后少了一个冒号「:」', line);
      }
      if (/^(if|elif|else|for|while|def)\b.*:\s*$/.test(text)) {
        var hasBody = false;
        for (var kb = i + 1; kb < lines.length; kb++) {
          var nl = lines[kb];
          if (!nl.text.trim() || nl.text.trim().indexOf('#') === 0) continue;
          hasBody = nl.indent > indent;
          break;
        }
        if (!hasBody) throw this.err('这个语句下面需要缩进写一段代码（通常缩进 4 个空格）', line);
      }

      /* return */
      if (/^return\b/.test(text)) {
        var rest = text.slice(6).trim();
        this.__ret = rest ? this.evalExpr(rest, line) : null;
        return i + 1;
      }
      /* break / continue / pass */
      if (text === 'break') { this.__break = true; return i + 1; }
      if (text === 'continue') { this.__continue = true; return i + 1; }
      if (text === 'pass') return i + 1;

      /* if / elif / else */
      var mIf = text.match(/^if\s+(.+?)\s*:\s*$/);
      if (mIf) {
        var taken = false;
        if (truthy(this.evalExpr(mIf[1], line))) { this.execBlock(lines.slice(i + 1), indent + 4); taken = true; }
        var j = this.skipBlock(lines, i + 1, indent);
        for (;;) {
          var l2 = lines[j];
          if (!l2 || l2.indent !== indent) break;
          var t2 = l2.text.trim();
          var mElif = t2.match(/^elif\s+(.+?)\s*:\s*$/);
          if (mElif) {
            if (!taken && truthy(this.evalExpr(mElif[1], l2.no))) { this.execBlock(lines.slice(j + 1), indent + 4); taken = true; }
            j = this.skipBlock(lines, j + 1, indent);
            continue;
          }
          if (/^else\s*:\s*$/.test(t2)) {
            if (!taken) this.execBlock(lines.slice(j + 1), indent + 4);
            j = this.skipBlock(lines, j + 1, indent);
          }
          break;
        }
        if (this.__break || this.__continue || this.__ret !== undefined) return j;
        return j;
      }
      if (/^else\s*:/.test(text) || /^elif\b/.test(text)) throw this.err('这个 else / elif 前面没有对应的 if', line);

      /* while */
      var mWhile = text.match(/^while\s+(.+?)\s*:\s*$/);
      if (mWhile) {
        var endW = this.skipBlock(lines, i + 1, indent);
        while (truthy(this.evalExpr(mWhile[1], line))) {
          this.tick(line);
          this.execBlock(lines.slice(i + 1), indent + 4);
          if (this.__break) { this.__break = false; break; }
          if (this.__continue) { this.__continue = false; }
        }
        return endW;
      }

      /* for */
      var mFor = text.match(/^for\s+([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)\s+in\s+(.+?)\s*:\s*$/);
      if (mFor) {
        var iterable = this.evalExpr(mFor[2], line);
        if (!Array.isArray(iterable)) {
          if (typeof iterable === 'string') iterable = iterable.split('');
          else if (typeof iterable === 'number') iterable = this.builtins.range(iterable);
          else throw this.err('for 后面需要一个列表或 range()', line);
        }
        var endF = this.skipBlock(lines, i + 1, indent);
        for (var k = 0; k < iterable.length; k++) {
          this.tick(line);
          this.vars[mFor[1]] = iterable[k];
          this.execBlock(lines.slice(i + 1), indent + 4);
          if (this.__break) { this.__break = false; break; }
          if (this.__continue) { this.__continue = false; }
          if (this.__ret !== undefined) return endF;
        }
        return endF;
      }

      /* def */
      var mDef = text.match(/^def\s+([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)\s*\((.*)\)\s*:\s*$/);
      if (mDef) {
        var endD = this.skipBlock(lines, i + 1, indent);
        var params = mDef[2].trim() ? mDef[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
        this.funcs[mDef[1]] = { params: params, body: lines.slice(i + 1, endD), baseIndent: indent + 4 };
        return endD;
      }

      /* 赋值：a = ...，支持 += -= */
      var mAssign = text.match(/^([A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)\s*(\+|-|\*|\/)?=\s*(.+)$/);
      if (mAssign && !/^==/.test(text)) {
        var val = this.evalExpr(mAssign[3], line);
        if (mAssign[2]) {
          var cur = this.vars[mAssign[1]];
          if (cur === undefined) throw this.err('「' + mAssign[1] + '」还没有值，不能做运算', line);
          if (mAssign[2] === '+') val = (typeof cur === 'string' || typeof val === 'string') ? this.show(cur) + this.show(val) : cur + val;
          else if (mAssign[2] === '-') val = cur - val;
          else if (mAssign[2] === '*') val = cur * val;
          else if (mAssign[2] === '/') val = cur / val;
        }
        this.vars[mAssign[1]] = val;
        return i + 1;
      }

      /* 表达式（含函数调用） */
      var v = this.evalExpr(text, line);
      return i + 1;
    };

    /** 跳过属于当前块的后续行 */
    Interp.prototype.skipBlock = function (lines, start, indent) {
      var i = start;
      while (i < lines.length) {
        var l = lines[i];
        if (!l.text.trim() || l.text.trim().indexOf('#') === 0) { i++; continue; }
        if (l.indent <= indent) break;
        i++;
      }
      return i;
    };

    Interp.prototype.evalExpr = function (src, line) {
      var tokens = tokenize(src);
      var p = new Parser(tokens, this, line);
      var v = p.parseExpr();
      if (!p.atEnd()) throw this.err('这一行有多余的内容', line);
      return v;
    };

    /** 执行整段代码：先按缩进切行，再逐句执行 */
    Interp.prototype.run = function (code) {
      var rawLines = String(code || '').replace(/\r/g, '').split('\n');
      var lines = [];
      var logical = null;
      rawLines.forEach(function (text, idx) {
        var no = idx + 1;
        if (!text.trim()) { lines.push({ text: '', indent: 0, no: no }); return; }
        var indent = text.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
        var body = text.replace(/^[ \t]*/, '');
        // 反斜杠续行或括号未闭合：合并到下一行
        if (logical) { logical.text += ' ' + body.trim(); logical.closed = isBalanced(logical.text); if (logical.closed) { lines.push(logical); logical = null; } return; }
        var l = { text: body, indent: indent, no: no };
        if (/[\\[(]\s*$/.test(body) && !isBalanced(body)) { l.closed = false; l.text = body.replace(/\\\s*$/, ''); logical = l; return; }
        lines.push(l);
      });
      if (logical) lines.push(logical);
      this.__break = false; this.__continue = false; this.__ret = undefined;
      this.execBlock(lines, 0);
      return this.out;
    };
    function isBalanced(s) {
      var depth = 0;
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === '"' || c === "'") { var q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } }
      }
      return depth <= 0;
    }

    return { Interp: Interp, run: function (code, opt) { return new Interp(opt).run(code); } };
  })();

  /* ================================================================
   * 二、绘图舞台（Python 与 JS 共用）
   * ================================================================ */
  function DrawStage() {
    var W = 300, H = 300;
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'aiq-svg');
    var g = document.createElementNS(SVGNS, 'g');
    svg.appendChild(g);
    var pen = { x: 0, y: 0, color: '#1f6f5c', size: 2 };
    var ctx = {
      clear: function () { while (g.firstChild) g.removeChild(g.firstChild); },
      moveTo: function (x, y) { pen.x = x; pen.y = y; },
      lineTo: function (x, y) {
        var l = document.createElementNS(SVGNS, 'line');
        l.setAttribute('x1', pen.x); l.setAttribute('y1', H - pen.y);
        l.setAttribute('x2', x); l.setAttribute('y2', H - y);
        l.setAttribute('stroke', pen.color); l.setAttribute('stroke-width', pen.size);
        l.setAttribute('stroke-linecap', 'round');
        g.appendChild(l);
        pen.x = x; pen.y = y;
      },
      circle: function (x, y, r) {
        var c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', H - y); c.setAttribute('r', r);
        c.setAttribute('fill', 'none'); c.setAttribute('stroke', pen.color); c.setAttribute('stroke-width', pen.size);
        g.appendChild(c);
      },
      rect: function (x, y, w, h) {
        var r = document.createElementNS(SVGNS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', H - y - h); r.setAttribute('width', w); r.setAttribute('height', h);
        r.setAttribute('fill', 'none'); r.setAttribute('stroke', pen.color); r.setAttribute('stroke-width', pen.size);
        g.appendChild(r);
      },
      dot: function (x, y) {
        var c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', H - y); c.setAttribute('r', Math.max(2, pen.size));
        c.setAttribute('fill', pen.color);
        g.appendChild(c);
      },
      penColor: function (c) { pen.color = String(c); },
      penSize: function (n) { pen.size = Number(n) || 2; },
      svg: svg
    };
    return ctx;
  }

  /* ================================================================
   * 三、积木走迷宫
   * ================================================================ */
  /* ================= 故事关卡 =================
   * 每一关都是一张「任务卡」：有角色、有目标、有奖励。
   * 关键约束：题目只在「转向 + 前进」两种原语内可解 ——
   * 否则孩子明明搭对了却过不了关，比不做还伤。
   * 起点一律朝东(dir = 0)。
   */
  /*
   * ================= 关卡即项目（PBL）=================
   * 四关分别对应四条计算思维主线，不是一个比一个「更难」，
   * 而是每关换一种「想问题的方式」：
   *   第1关 顺序 —— 一步一步按次序走
   *   第2关 循环 —— 同一段路走很多次，用「重复」省力
   *   第3关 条件 —— 用「前方有墙？」这个传感器做判断
   *   第4关 巡逻 —— 绕场一周；把「前进5步 + 右转」当成一个大动作
   * 每一关都用 BFS 验证过「在积木原语下真的可解」（tests/maze.test.js）。
   */
  var LEVELS = [
    {
      story: '点亮灯塔', emoji: '🗼', concept: '顺序',
      title: '按次序踩亮三个机关，灯塔就会亮',
      learn: '学会「顺序」：程序是一步一步按次序执行的',
      rows: 5, cols: 5, start: { r: 0, c: 0, dir: 0 }, goal: { r: 4, c: 4 },
      walls: [[1, 3], [3, 0], [2, 2]],
      plates: [{ r: 1, c: 1 }, { r: 4, c: 1 }, { r: 3, c: 3 }],
      items: [{ r: 0, c: 2, icon: '🔋' }],
      hint: '三个机关的位置：先往东再往南。踩到机关会亮起来。',
      ref: [
        {
          "type": "move"
        },
        {
          "type": "right"
        },
        {
          "type": "repeat",
          "times": 4,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "repeat",
          "times": 2,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "move"
        },
        {
          "type": "right"
        },
        {
          "type": "move"
        },
        {
          "type": "right"
        },
        {
          "type": "move"
        }
      ]
    },
    {
      story: '搬空果园', emoji: '🍎', concept: '循环',
      title: '一共 5 个苹果，用「重复」一次摘完',
      learn: '学会「循环」：重复做同一件事，不用把积木拼五遍',
      rows: 6, cols: 6, start: { r: 0, c: 0, dir: 0 }, goal: { r: 5, c: 5 },
      walls: [[2, 2]],
      apples: [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 0, c: 5 }, { r: 5, c: 2 }, { r: 5, c: 4 }],
      items: [{ r: 5, c: 0, icon: '🪜' }],
      hint: '路上有五颗苹果。与其拼五块「前进」，不如用一块「重复 5 次」把「前进」包起来。',
      ref: [
        {
          "type": "repeat",
          "times": 2,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 2,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "pick"
        },
        {
          "type": "move"
        },
        {
          "type": "right"
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 5,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "right"
        },
        {
          "type": "repeat",
          "times": 3,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "repeat",
          "times": 2,
          "body": [
            {
              "type": "left"
            }
          ]
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 2,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "pick"
        },
        {
          "type": "move"
        }
      ]
    },
    {
      story: '避开陷阱', emoji: '🕳️', concept: '条件',
      title: '前路有深坑，用「如果…就…」自己判断',
      learn: '学会「条件」：先判断，再决定做什么',
      rows: 6, cols: 6, start: { r: 5, c: 0, dir: 0 }, goal: { r: 0, c: 5 },
      walls: [[4, 3], [3, 1], [1, 4]],
      apples: [{ r: 3, c: 3 }, { r: 0, c: 0 }],
      hint: '把「如果 前方有墙 就 右转」放进「重复」里，小AI 就会自己绕开障碍。',
      ref: [
        {
          "type": "left"
        },
        {
          "type": "repeat",
          "times": 5,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "right"
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 3,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "right"
        },
        {
          "type": "repeat",
          "times": 3,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 2,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "repeat",
          "times": 3,
          "body": [
            {
              "type": "move"
            }
          ]
        }
      ]
    },
    {
      story: '巡逻任务', emoji: '🐕', concept: '循环',
      title: '绕场地巡逻一圈，回到出发点',
      learn: '进阶「循环」：把「前进 5 步 + 右转」当成一个大动作，重复 4 次',
      rows: 6, cols: 6, start: { r: 5, c: 0, dir: 0 }, goal: { r: 5, c: 0 },
      walls: [[3, 3]],
      apples: [{ r: 5, c: 5 }, { r: 0, c: 0 }],
      hint: '一圈有四条边，每条边都一样长。先想清楚「一条边」怎么做，再重复 4 次。',
      ref: [
        {
          "type": "repeat",
          "times": 5,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 5,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "repeat",
          "times": 5,
          "body": [
            {
              "type": "move"
            }
          ]
        },
        {
          "type": "left"
        },
        {
          "type": "pick"
        },
        {
          "type": "repeat",
          "times": 5,
          "body": [
            {
              "type": "move"
            }
          ]
        }
      ]
    }
  ];
  var DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // 右 下 左 上

  /* ================= 小AI 走迷宫（游戏化重写） =================
   * 设计原则：让孩子觉得在玩拼图，不是在做编程作业。
   *   · 积木有厚度、有立体感、有颜色分类，能拖能点
   *   · 地图是草地 + 树丛 + 石头，不是一个灰网格
   *   · 主角是会呼吸、会眨眼、会走路的小AI（复用绘本的骨骼系统）
   *   · 撞墙要「哎哟」一声弹回来，通关要蹦跳撒彩带
   *   · Python 代码放进一本「魔法书」，逐行亮起并和积木对应
   */
  var BLK_CATS = {
    event:  { name: '事件', cls: 'cat-event' },
    action: { name: '动作', cls: 'cat-action' },
    turn:   { name: '转向', cls: 'cat-turn' },
    item:   { name: '物品', cls: 'cat-item' },
    ctrl:   { name: '逻辑控制', cls: 'cat-ctrl' },
    sense:  { name: '感知', cls: 'cat-sense' }
  };
  /*
   * 积木语言 —— 每一类对应一条真正的计算思维：
   *   事件：当绿旗被按下        → 事件驱动
   *   动作：前进                → 顺序执行
   *   转向：左转 / 右转          → 顺序执行
   *   物品：收集 / 放下          → 状态改变
   *   逻辑：重复 N 次 / 如果…就… → 循环、条件分支
   *   感知：前方有墙？           → 布尔传感器，返回真/假，本身不产生动作
   */
  var POOL_DEF = [
    { type: 'onflag', label: '当绿旗被按下', icon: '🚩', cat: 'event' },
    { type: 'move',   label: '前进 1 步',    icon: '⬆️', cat: 'action' },
    { type: 'left',   label: '左转 90°',     icon: '↺',  cat: 'turn' },
    { type: 'right',  label: '右转 90°',     icon: '↻',  cat: 'turn' },
    { type: 'pick',   label: '收集',         icon: '🤏', cat: 'item' },
    { type: 'drop',   label: '放下',         icon: '👐', cat: 'item' },
    { type: 'repeat', label: '重复 N 次',    icon: '🔁', cat: 'ctrl' },
    { type: 'if',     label: '如果…就…',     icon: '❓', cat: 'ctrl' }
  ];
  /* 感知积木是「条件」，只能放进「如果…就…」的插槽，不能单独拖进程序 */
  var SENSE_DEF = [
    { type: 'wall', name: '前方有墙', fn: 'robot.wall_ahead()' }
  ];

  /* ================= 学段自适应 =================
   * 低年级（depth 1-2）先学「顺序」和「循环」——这两条是所有编程的地基；
   * 高年级（depth 3-4）才出现「条件」和「进阶循环」。
   * 一上来就给 2 年级孩子看「如果…就…」，他只会照抄，学不到东西。
   */
  var TIER = [
    { max: 2, ids: [0, 1], tip: '先掌握「顺序」和「循环」——这两条是所有编程的地基。' },
    { max: 3, ids: [0, 1, 2], tip: '顺序 → 循环 → 条件，三关都要过。' },
    { max: 4, ids: [0, 1, 2, 3], tip: '四关全开：顺序 → 循环 → 条件 → 进阶循环。' }
  ];
  function depthOf() {
    var host = qs('#code-stage');
    var d = host ? Number(host.getAttribute('data-depth')) : 0;
    return d >= 1 && d <= 4 ? d : 2;      /* 取不到就按小学中年级 */
  }
  function tierOf() {
    var d = depthOf();
    return TIER.filter(function (t) { return d <= t.max; })[0] || TIER[TIER.length - 1];
  }
  function renderMaze(host) {
    /* 每次进入这个页签都会重新渲染一次。
       不先清空 host 就会留下上一份的 .maze-stage / .star-bar / 助手，
       于是 querySelector 命中旧元素 —— 进度条看着一直不更新就是这么来的。 */
    AIQ.clear(host);
    /* 只让当前学段该看到的关卡出现 */
    var tier = tierOf();
    var VISIBLE = tier.ids.map(function (k) { return LEVELS[k]; });
    /* 关卡解锁：第 1 关永远开；后面每一关要求上一关已通关。
       没通过第 1 关就跳到第 4 关，孩子会跳过「顺序」这个地基。 */
    var done = {};
    function unlocked(i) {
      if (i === 0) return true;
      return !!done[VISIBLE[i - 1].story];
    }
    function refreshProgress() {
      return api('/api/lab/progress').then(function (r) {
        done = {};
        (r.done || []).forEach(function (s) { done[s] = true; });
      }).catch(function () { /* 取不到就当没通关过，至少第 1 关能玩 */ });
    }
    var levelIndex = 0;
    var blocks = [];
    /* ⚠️ 必须指向 blocks 本身。
       这里如果写成 { path: [] }，就成了另一个空数组：
       积木推给了 scope.path，而渲染读的是 blocks —— 永远是空的。 */
    var scope = { path: blocks };
    var running = false;
    var actorEl = null;          /* 当前主角的 SVG 组 */
    var walkTimer = null;

    var stageBox = el('div', { class: 'maze-stage' });
    var svgHolder = el('div', { class: 'maze-map' });
    var scriptBox = el('div', { class: 'script-area' });
    var mirror = el('pre', { class: 'magic-book', text: '# 拼好积木，这里会亮起对应的 Python' });
    var status = el('div', { class: 'stage-hint' });
    var starBar = el('div', { class: 'star-bar' });
    var levelRow = el('div', { class: 'quest-row' });

    function lv() { return VISIBLE[levelIndex]; }

    /* ---------- 任务卡 ---------- */
    function paintLevels() {
      AIQ.clear(levelRow);
    VISIBLE.forEach(function (L, i) {
      var open = unlocked(i);
      var passed = !!done[L.story];
      levelRow.appendChild(el('button', {
        class: 'quest-card' + (i === levelIndex ? ' is-on' : '') + (open ? '' : ' is-locked') + (passed ? ' is-passed' : ''),
        type: 'button',
        title: open ? '' : '先通过上一关才能解锁',
        onclick: function (ev) {
          if (!open) {
            AIQ.toast({ type: 'warn', text: '先通过「' + VISIBLE[i - 1].story + '」才能解锁这一关哦' });
            Say.say('先通过' + VISIBLE[i - 1].story + '，才能解锁这一关');
            return;
          }
          levelIndex = i; blocks = []; scope = { path: blocks };
          AIQ.qsa('.quest-card', levelRow).forEach(function (x) { x.classList.remove('is-on'); });
          ev.currentTarget.classList.add('is-on');
          reset(); renderScript();
          Say.say('第' + (i + 1) + '关，' + LEVELS[i].story + '。' + LEVELS[i].title);
        }
      }, [
        el('span', { class: 'quest-no', text: '第 ' + (i + 1) + ' 关' }),
        el('span', { class: 'quest-emoji', text: L.emoji }),
        el('span', { class: 'quest-name', text: L.story }),
        el('span', { class: 'quest-concept', text: '★ ' + (L.concept || '') }),
        el('span', { class: 'quest-learn', text: L.learn }),
        el('span', { class: 'quest-state', text: passed ? '✅ 已通关' : (open ? '▶ 可以挑战' : '🔒 未解锁') })
      ]));
    });
    }
    paintLevels();
    refreshProgress().then(function () { paintLevels(); });
    function questHead() {
      var L = lv();
      return el('div', { class: 'quest-head' }, [
        el('span', { class: 'quest-emoji-big', text: L.emoji }),
        el('div', {}, [
          el('b', { text: L.title }),
          el('div', { class: 'small muted', text: '本关目标：' + L.learn })
        ])
      ]);
    }
    var headBox = el('div', {});
    function paintHead() { AIQ.clear(headBox); headBox.appendChild(questHead()); }

    /* ---------- 指令背包（可拖拽） ---------- */
    var poolBox = el('div', { class: 'block-pool' });
    POOL_DEF.forEach(function (b) {
      var node = el('button', {
        class: 'blk-piece ' + BLK_CATS[b.cat].cls, type: 'button', draggable: 'true',
        'data-type': b.type
      }, [
        el('span', { class: 'blk-icon', text: b.icon }),
        el('span', { class: 'blk-label', text: b.label })
      ]);
      /* 拖拽时跟手飞行的「幽灵块」。
         原生 HTML5 拖拽的默认预览图是浏览器自己截的半透明小图，跟随感很差；
         这里用一个绝对定位的浮层自己画一个，并且跟着 pointermove 走。
         —— 这是上一轮我说「没做」的那个效果，现在补上，仍然零依赖。 */
      node.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', b.type);
        e.dataTransfer.effectAllowed = 'copy';
        node.classList.add('is-dragging');
        Ghost.show(b, e.clientX, e.clientY);
        if (typeof SFX !== 'undefined' && SFX.play) SFX.play('pop');
      });
      node.addEventListener('dragend', function () {
        node.classList.remove('is-dragging');
        Ghost.hide();
      });
      node.onclick = function () { addBlock(b.type); };
      poolBox.appendChild(node);
    });

    /* ---------- 拖拽幽灵块 ---------- */
    var Ghost = (function () {
      var box = null;
      function ensure() {
        if (box) return box;
        box = el('div', { class: 'blk-ghost' });
        document.body.appendChild(box);
        return box;
      }
      /* 用 pointermove 而不是 dragover：dragover 在有些浏览器里节流很厉害，跟手会卡 */
      document.addEventListener('pointermove', function (e) {
        if (!box || !box.classList.contains('is-on')) return;
        box.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 10) + 'px) rotate(-3deg)';
      });
      document.addEventListener('dragover', function (e) {
        if (!box || !box.classList.contains('is-on')) return;
        box.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 10) + 'px) rotate(-3deg)';
      });
      return {
        show: function (def, x, y) {
          var n = ensure();
          AIQ.clear(n);
          n.className = 'blk-ghost is-on ' + BLK_CATS[def.cat].cls;
          n.appendChild(el('span', { class: 'blk-icon', text: def.icon }));
          n.appendChild(el('span', { class: 'blk-label', text: def.label }));
          n.style.transform = 'translate(' + (x + 14) + 'px,' + (y + 10) + 'px) rotate(-3deg)';
        },
        hide: function () { if (box) box.className = 'blk-ghost'; }
      };
    })();

    /* 感知积木单独一排：它的「用法」和别的积木不同 —— 只能当条件，
       所以视觉上也分开摆，孩子一眼就知道它不是拿来直接执行的。 */
    var senseBox = el('div', { class: 'block-pool sense-row' });
    SENSE_DEF.forEach(function (s) {
      var node = el('button', {
        class: 'blk-piece cat-sense', type: 'button', draggable: 'true', 'data-type': s.type
      }, [
        el('span', { class: 'blk-icon', text: '👀' }),
        el('span', { class: 'blk-label', text: s.name + '？' })
      ]);
      node.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', s.type);
        Ghost.show({ icon: '👀', label: s.name + '？', cat: 'sense' }, e.clientX, e.clientY);
      });
      node.addEventListener('dragend', function () { Ghost.hide(); });
      node.onclick = function () {
        AIQ.toast({ type: 'info', text: '「' + s.name + '」是判断条件，把它拖进「如果…就…」的空槽里' });
        Say.say(s.name + '，这是判断条件，要放进如果就的槽里');
      };
      senseBox.appendChild(node);
    });

    var scriptArea = el('div', { class: 'program-area', id: 'program-area' });
    /* scriptArea 只挂这一次。后面 renderScript() 只清空它自己的内容，
       绝不碰父节点 —— 父节点被清空过一次，这个引用就再也回不到页面上了。 */
    scriptBox.appendChild(scriptArea);
    scriptArea.addEventListener('dragover', function (e) { e.preventDefault(); scriptArea.classList.add('is-over'); });
    scriptArea.addEventListener('dragleave', function () { scriptArea.classList.remove('is-over'); });
    scriptArea.addEventListener('drop', function (e) {
      e.preventDefault(); scriptArea.classList.remove('is-over');
      var t = e.dataTransfer.getData('text/plain');
      if (t) addBlock(t);
    });

    function addBlock(type) {
      if (running) return;
      var node = { type: type, id: AIQ.uid('b'), body: isHolder(type) ? [] : null, times: 3 };
      if (type === 'if') node.cond = 'wall';
      scope.path.push(node);
      if (typeof SFX !== 'undefined' && SFX.play) SFX.play('pop');
      renderScript();
      /* 每加一块就念出它的名字 —— 孩子靠「听」记住指令，比看字有效 */
      var d = POOL_DEF.filter(function (x) { return x.type === type; })[0];
      if (d) Say.say(d.label);
    }
    function findParent(list, id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list;
        if (list[i].body) { var r = findParent(list[i].body, id); if (r) return r; }
      }
      return null;
    }
    function removeBlock(id) {
      var p = findParent(blocks, id);
      if (!p) return;
      for (var i = 0; i < p.length; i++) { if (p[i].id === id) { p.splice(i, 1); break; } }
      resetScope();
      renderScript();
    }
    function moveBlock(id, dir) {
      var p = findParent(blocks, id);
      if (!p) return;
      var i = p.map(function (x) { return x.id; }).indexOf(id);
      var j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return;
      var t = p[i]; p[i] = p[j]; p[j] = t;
      resetScope();
      renderScript();
    }
    function resetScope() { scope = { path: blocks }; }

    /* ---------- 程序区渲染 ----------
     * ⚠️ 这里只清空 scriptArea 自己的内容，**绝不能清空它的父节点**。
     * 之前每渲染一次就 AIQ.clear(scriptBox) 再 appendChild(scriptArea)，
     * 第一次就把 scriptArea 从 DOM 上摘下来、装回去的是另一次调用的引用 ——
     * 结果程序区被永久替换成空壳，积木怎么点都进不去。
     */
    function renderScript() {
      AIQ.clear(scriptArea);
      if (!blocks.length) {
        scriptArea.appendChild(el('div', { class: 'program-empty' }, [
          el('span', { text: '把左边的积木拖到这里' }),
          el('span', { class: 'small muted', text: '（也可以直接点积木）' })
        ]));
      } else {
        blocks.forEach(function (n) { scriptArea.appendChild(blockNode(n, blocks)); });
      }
      renderBook();
    }

    /* 哪些积木是「容器」（身体里可以再塞积木） */
    function isHolder(t) { return t === 'repeat' || t === 'if'; }
    function makeNode(t) {
      var n = { type: t, id: AIQ.uid('b'), body: isHolder(t) ? [] : null, times: 3 };
      if (t === 'if') n.cond = 'wall';
      return n;
    }
    /* 容器里的「插槽」：重复块的空位 / 如果块的条件与动作 */
    function attachBody(box, node, hint) {
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('is-over'); });
      box.addEventListener('dragleave', function () { box.classList.remove('is-over'); });
      box.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation(); box.classList.remove('is-over');
        var t = e.dataTransfer.getData('text/plain');
        /* 感知积木只对「如果…就…」有意义，塞进重复块要拦一下 */
        if (t && SENSE_DEF.some(function (s) { return s.type === t; })) {
          AIQ.toast({ type: 'warn', text: '「' + senseName(t) + '」是判断条件，要放进「如果…就…」的空槽里' });
          return;
        }
        if (t && !running && POOL_DEF.some(function (d) { return d.type === t; })) {
          node.body.push(makeNode(t)); resetScope(); renderScript();
        }
      });
      if (!node.body.length) box.appendChild(el('span', { class: 'small muted', text: hint }));
      else node.body.forEach(function (c) { box.appendChild(blockNode(c, node.body)); });
    }
    function senseName(t) { var s = SENSE_DEF.filter(function (x) { return x.type === t; })[0]; return s ? s.name : t; }

    function blockNode(node, siblings) {
      var def = POOL_DEF.filter(function (x) { return x.type === node.type; })[0] ||
        { label: node.type, icon: '?', cat: 'action' };
      var row = el('div', { class: 'blk-row ' + BLK_CATS[def.cat].cls, 'data-id': node.id }, [
        el('span', { class: 'blk-icon', text: def.icon }),
        el('span', { class: 'blk-label', text: def.label })
      ]);
      if (node.type === 'repeat') {
        row.appendChild(el('input', {
          class: 'blk-times', type: 'number', min: '1', max: '20', value: String(node.times),
          oninput: function (e) { node.times = Math.max(1, Math.min(20, Number(e.target.value) || 1)); renderBook(); },
          onclick: function (e) { e.stopPropagation(); }
        }));
        row.appendChild(el('span', { class: 'blk-label', text: '次' }));
      }
      if (node.type === 'if') {
        /* 条件槽：把感知积木拖进来，或者点一下在几个传感器之间切换 */
        var slot = el('span', {
          class: 'blk-slot', title: '把感知积木拖到这里',
          text: senseName(node.cond),
          onclick: function (e) {
            e.stopPropagation();
            var i = SENSE_DEF.map(function (s) { return s.type; }).indexOf(node.cond);
            node.cond = SENSE_DEF[(i + 1) % SENSE_DEF.length].type;
            renderScript();
          }
        });
        row.appendChild(slot);
        row.appendChild(el('span', { class: 'blk-label', text: '就' }));
      }
      var ops = el('span', { class: 'blk-ops' }, [
        el('button', { class: 'blk-op', type: 'button', text: '↑', title: '上移', onclick: function (e) { e.stopPropagation(); moveBlock(node.id, -1); } }),
        el('button', { class: 'blk-op', type: 'button', text: '↓', title: '下移', onclick: function (e) { e.stopPropagation(); moveBlock(node.id, 1); } }),
        el('button', { class: 'blk-op', type: 'button', text: '✕', title: '删掉', onclick: function (e) { e.stopPropagation(); removeBlock(node.id); } })
      ]);
      row.appendChild(ops);
      if (isHolder(node.type)) {
        var body = el('div', { class: 'blk-body' + (node.type === 'if' ? ' blk-body-if' : '') });
        attachBody(body, node, node.type === 'repeat' ? '把要重复的积木拖进来' : '把要做的事拖进来');
        return el('div', { class: 'blk-wrap' }, [row, body]);
      }
      return row;
    }

    /* ---------- 魔法书：积木 ↔ Python ----------
     * 这是一条真正的「积木 → AST → 代码生成」流水线：
     *   toPythonLines() 递归遍历积木树，遇到容器就多缩进一层，
     *   遇到「如果…就…」就生成 if 语句，感知积木变成布尔表达式。
     */
    function renderBook() {
      AIQ.clear(mirror);
      var lines = toPythonLines(blocks, 0);
      if (!lines.length) {
        mirror.appendChild(el('div', { class: 'mb-line mb-comment', text: '# 拼好积木，这里会亮起对应的 Python' }));
        return;
      }
      lines.forEach(function (L, i) {
        mirror.appendChild(el('div', {
          class: 'mb-line mb-typing' + (L.comment ? ' mb-comment' : '') + (L.loop ? ' mb-loop' : '') +
            (L.cond ? ' mb-cond' : '') + (L.event ? ' mb-event' : ''),
          'data-block': L.block || '',
          /* 打字机：每行依次浮现。纯 CSS 动画，不用定时器，
             所以连续改积木时也不会积一堆 timer。 */
          style: { animationDelay: (i * 0.09).toFixed(2) + 's' }
        }, [
          el('span', { class: 'mb-no', text: String(i + 1).padStart(2, ' ') }),
          el('code', { text: L.text })
        ]));
      });
    }
    function pyOfNode(n) { return PY_OF[n.type] || n.type; }
    function toPythonLines(list, depth) {
      var out = [];
      list.forEach(function (n) {
        var pad = '    '.repeat(depth);
        if (n.type === 'repeat') {
          out.push({ text: pad + 'for i in range(' + n.times + '):', block: n.id, loop: true });
          pushBody(out, n.body, depth + 1, n.id);
        } else if (n.type === 'if') {
          var sense = SENSE_DEF.filter(function (s) { return s.type === n.cond; })[0] || SENSE_DEF[0];
          out.push({ text: pad + 'if ' + sense.fn + ':', block: n.id, cond: true });
          pushBody(out, n.body, depth + 1, n.id);
        } else if (n.type === 'onflag') {
          out.push({ text: 'def when_green_flag_clicked():', block: n.id, event: true });
        } else {
          out.push({ text: pad + pyOfNode(n), block: n.id });
        }
      });
      return out;
    }
    function pushBody(out, body, depth, holderId) {
      var pad = '    '.repeat(depth);
      var inner = toPythonLines(body || [], depth);
      if (!inner.length) out.push({ text: pad + 'pass', block: holderId, comment: true });
      else inner.forEach(function (L) { out.push(L); });
    }
    var PY_OF = {
      move: 'robot.forward()', left: 'robot.turn_left()', right: 'robot.turn_right()',
      pick: 'robot.collect()', drop: 'robot.put_down()'
    };
    /* 保留旧函数名，run() 里用的仍是 toPython 的语义 */
    function toPython(list) { return toPythonLines(list, 0).map(function (L) { return L.text; }).join('\n') + '\n'; }

    /* ---------- 地图 ---------- */
    var CELL = 54, PAD = 18;
    function reset() {
      running = false;
      var L = lv();
      /* 画布上方要多留 40：主角的头伸到格子之上，不留就会被裁顶。
         下方多留 8，给影子和脚下的草留点呼吸。 */
      var TOP_PAD = PAD + 40, BOT_PAD = PAD + 8;
      var W = L.cols * CELL + PAD * 2, H = L.rows * CELL + TOP_PAD + BOT_PAD;
      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('class', 'aiq-svg maze-svg');
      var g = document.createElementNS(SVGNS, 'g');
      svg.appendChild(g);
      AIQ.clear(svgHolder);
      svgHolder.appendChild(svg);
      actorEl = null;
      starBar.textContent = '';
      paintHead();
      status.textContent = L.hint;

      function draw(state) {
        while (g.firstChild) g.removeChild(g.firstChild);
        var L = lv();
        /* 草地：底色 + 一格一格的浅色草皮（不是灰网格）。
           ⚠️ 这里的 g 是 SVG 的 <g>，但 el() 用的是 createElement —— 它造不出 SVG 节点，
           所以草地这一张底必须用 add()（内部走 createElementNS）。 */
        add(g, 'rect', { x: 0, y: 0, width: W, height: H, rx: 18, fill: '#dff0d0' });
        for (var r = 0; r < L.rows; r++) {
          for (var c = 0; c < L.cols; c++) {
            add(g, 'rect', {
              x: PAD + c * CELL + 2, y: TOP_PAD + r * CELL + 2, width: CELL - 4, height: CELL - 4, rx: 12,
              fill: (r + c) % 2 ? '#e8f6da' : '#d9efc6'
            });
          }
        }
        /* 障碍：树丛 / 石头 */
        (L.walls || []).forEach(function (w, i) {
          var x = PAD + w[1] * CELL + CELL / 2, y = TOP_PAD + w[0] * CELL + CELL / 2;
          if (i % 2 === 0) {
            add(g, 'ellipse', { cx: x, cy: y + 12, rx: 20, ry: 7, fill: 'rgba(120,150,90,.28)' });
            add(g, 'circle', { cx: x, cy: y - 2, r: 17, fill: '#8fc47c' });
            add(g, 'circle', { cx: x - 8, cy: y + 5, r: 11, fill: '#a4d492' });
            add(g, 'circle', { cx: x + 9, cy: y + 6, r: 9, fill: '#7cb86a' });
          } else {
            add(g, 'ellipse', { cx: x, cy: y + 12, rx: 17, ry: 6, fill: 'rgba(120,150,90,.28)' });
            add(g, 'ellipse', { cx: x, cy: y, rx: 16, ry: 13, fill: '#c9c1b4' });
            add(g, 'ellipse', { cx: x - 4, cy: y - 4, rx: 8, ry: 6, fill: '#ded7cb' });
          }
        });
        /* 星星（收集品）：踩到就收 */
        (L.stars || []).forEach(function (s) {
          if (state.got && state.got[s.r + ',' + s.c]) return;
          var x = PAD + s.c * CELL + CELL / 2, y = TOP_PAD + s.r * CELL + CELL / 2;
          add(g, 'circle', { cx: x, cy: y, r: 13, fill: '#fff2c0', opacity: 0.85 });
          add(g, 'text', { x: x, y: y + 7, 'font-size': 20, 'text-anchor': 'middle', class: 'map-star' }, '⭐');
        });
        /* 终点：一个发光的「家」 */
        var gx = PAD + L.goal.c * CELL + CELL / 2, gy = TOP_PAD + L.goal.r * CELL + CELL / 2;
        add(g, 'circle', { cx: gx, cy: gy, r: 24, fill: '#ffe9b0', opacity: 0.75, class: 'goal-glow' });
        add(g, 'text', { x: gx, y: gy + 10, 'font-size': 30, 'text-anchor': 'middle' }, '🏠');
        /* 包裹 */
        /* 机关（压力板）：踩上去会亮。第 1 关要按次序踩亮三个。 */
        (L.plates || []).forEach(function (p) {
          var on = state.got[p.r + ',' + p.c];
          var x = PAD + p.c * CELL + CELL / 2, y = TOP_PAD + p.r * CELL + CELL / 2;
          add(g, 'ellipse', { cx: x, cy: y + 6, rx: 19, ry: 12, fill: on ? '#ffe9a8' : '#d9c9a8', opacity: 0.9 });
          add(g, 'ellipse', { cx: x, cy: y + 3, rx: 14, ry: 9, fill: on ? '#ffd76a' : '#c8b795' });
          if (on) add(g, 'circle', { cx: x, cy: y + 3, r: 20, fill: '#ffe9a8', opacity: 0.5, class: 'goal-glow' });
          add(g, 'text', { x: x, y: y + 9, 'font-size': 17, 'text-anchor': 'middle' }, on ? '🔆' : '🔅');
        });
        /* 苹果：用「收集」积木摘走 */
        (L.apples || []).forEach(function (ap) {
          if (state.got[ap.r + ',' + ap.c]) return;
          var x = PAD + ap.c * CELL + CELL / 2, y = TOP_PAD + ap.r * CELL + CELL / 2;
          add(g, 'text', { x: x, y: y + 10, 'font-size': 27, 'text-anchor': 'middle', class: 'map-star' }, '🍎');
        });
        /* 道具（梯子、电池…） */
        (L.items || []).forEach(function (it) {
          if (state.got['item' + it.r + it.c]) return;
          add(g, 'text', {
            x: PAD + it.c * CELL + CELL / 2, y: TOP_PAD + it.r * CELL + CELL / 2 + 10,
            'font-size': 24, 'text-anchor': 'middle'
          }, it.icon || '📦');
        });
        if (L.item && !state.carrying && !state.itemTaken) {
          add(g, 'text', {
            x: PAD + L.item.c * CELL + CELL / 2, y: TOP_PAD + L.item.r * CELL + CELL / 2 + 9,
            'font-size': 26, 'text-anchor': 'middle'
          }, '📦');
        }
        /* 主角：小AI 骨骼（会呼吸、会眨眼） */
        var cx = PAD + state.c * CELL + CELL / 2, cy = TOP_PAD + state.r * CELL + CELL / 2 + 12;
        var rig = DRAW_ROBOT(cx, cy, state.dir, state.mood || 'happy', state.carrying);
        rig.forEach(function (n) { g.appendChild(n); });
      }
      /* ⚠️ 必须真的画一次 —— 只定义不调用的话，地图就是一片空白 */
      draw({
        r: L.start.r, c: L.start.c, dir: L.start.dir,
        carrying: false, got: {}, itemTaken: false, mood: 'happy'
      });
      return draw;
    }

    /* 主角：直接用绘本那套 9 部件骨骼，保证「会呼吸会眨眼」 */
    function DRAW_ROBOT(cx, cy, dir, mood, carrying) {
      var parts = [];
      var bodyG = document.createElementNS(SVGNS, 'g');
      bodyG.setAttribute('class', 'maze-actor' + (mood === 'ouch' ? ' is-ouch' : '') + (mood === 'win' ? ' is-win' : ''));
      /* 影子 */
      parts.push(add(null, 'ellipse', { cx: cx, cy: cy + 6, rx: 24, ry: 8, fill: 'rgba(90,120,60,.22)' }));
      /* 身体 */
      bodyG.appendChild(add(null, 'ellipse', { cx: cx, cy: cy - 20, rx: 21, ry: 17, fill: '#8fd8c4', stroke: 'rgba(60,120,105,.35)', 'stroke-width': 2 }));
      bodyG.appendChild(add(null, 'ellipse', { cx: cx, cy: cy - 16, rx: 11, ry: 8, fill: 'rgba(255,255,255,.4)' }));
      /* 两条腿 */
      bodyG.appendChild(add(null, 'rect', { x: cx - 13, y: cy - 8, width: 10, height: 9, rx: 4.5, fill: '#7fc8b4', stroke: 'rgba(60,120,105,.3)', 'stroke-width': 1.5 }));
      bodyG.appendChild(add(null, 'rect', { x: cx + 3, y: cy - 8, width: 10, height: 9, rx: 4.5, fill: '#7fc8b4', stroke: 'rgba(60,120,105,.3)', 'stroke-width': 1.5 }));
      /* 两只手 */
      bodyG.appendChild(add(null, 'rect', { x: cx - 30, y: cy - 28, width: 11, height: 9, rx: 4.5, fill: '#7fc8b4', stroke: 'rgba(60,120,105,.3)', 'stroke-width': 1.5 }));
      bodyG.appendChild(add(null, 'rect', { x: cx + 19, y: cy - 28, width: 11, height: 9, rx: 4.5, fill: '#7fc8b4', stroke: 'rgba(60,120,105,.3)', 'stroke-width': 1.5 }));
      /* 头 */
      var hy = cy - 46;
      bodyG.appendChild(add(null, 'circle', { cx: cx, cy: hy, r: 20, fill: '#fdfdf6', stroke: 'rgba(60,120,105,.4)', 'stroke-width': 2.4 }));
      /* 眼睛：两个纯色圆 + 高光，随朝向偏移 —— 这样孩子能看出它朝哪边 */
      var look = dir === 0 ? 3.5 : dir === 2 ? -3.5 : 0;
      var lookY = dir === 1 ? 2.5 : dir === 3 ? -2.5 : 0;
      [-7, 7].forEach(function (dx) {
        bodyG.appendChild(add(null, 'circle', { cx: cx + dx + look, cy: hy - 2 + lookY, r: 4.6, fill: '#3b3630' }));
        bodyG.appendChild(add(null, 'circle', { cx: cx + dx + look - 1.4, cy: hy - 3.6 + lookY, r: 1.7, fill: '#ffffff' }));
      });
      /* 嘴：撞墙是「哎哟」的小圆嘴，平时是微笑 */
      if (mood === 'ouch') {
        bodyG.appendChild(add(null, 'ellipse', { cx: cx, cy: hy + 10, rx: 4.4, ry: 5.6, fill: '#f2a8a8' }));
      } else {
        var mp = document.createElementNS(SVGNS, 'path');
        mp.setAttribute('d', 'M ' + (cx - 7) + ' ' + (hy + 8) + ' q 7 ' + 7 + ' 14 0');
        mp.setAttribute('stroke', '#3b3630'); mp.setAttribute('stroke-width', 2.2);
        mp.setAttribute('fill', 'none'); mp.setAttribute('stroke-linecap', 'round');
        bodyG.appendChild(mp);
      }
      /* 呆毛 */
      bodyG.appendChild(add(null, 'circle', { cx: cx, cy: hy - 22, r: 3.4, fill: '#ffc94d' }));
      parts.push(bodyG);
      if (carrying) parts.push(add(null, 'text', { x: cx + 24, y: cy - 40, 'font-size': 20, 'text-anchor': 'middle' }, '📦'));
      return parts;
    }

    function add(parent, tag, attrs, text) {
      var n = document.createElementNS(SVGNS, tag);
      for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
      if (text) n.textContent = text;
      if (parent) parent.appendChild(n);
      return n;
    }

    /* ---------- 展开 + 执行 ---------- */
    /* 展开成线性动作序列。
     * 「如果…就…」也被展开 —— 但条件是在**执行时**求值的（这才是条件分支），
     * 所以这里只是把「条件 + 分支体」打包成一个步骤。
     */
    function flattenBlocks(list, out, depth) {
      depth = depth || 0;
      list.forEach(function (n) {
        if (n.type === 'onflag') {
          out.push({ type: 'event', name: '当绿旗被按下' });
        } else if (n.type === 'repeat') {
          if (depth > 4) return;
          var body = flattenBlocks(n.body, [], depth + 1);
          if (!body.length) { out.push({ type: 'repeatEmpty' }); return; }
          for (var i = 0; i < n.times; i++) body.forEach(function (b) { out.push(b); });
        } else if (n.type === 'if') {
          if (depth > 4) return;
          out.push({ type: 'branch', cond: n.cond, body: flattenBlocks(n.body, [], depth + 1) });
        } else out.push({ type: n.type });
      });
      return out;
    }

    var DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];   /* 右 下 左 上 */

    function run() {
      if (running) return;
      var L = lv();
      var state = { r: L.start.r, c: L.start.c, dir: L.start.dir, carrying: false, got: {}, itemTaken: false, mood: 'happy' };
      var draw = reset();
      var actions = flattenBlocks(blocks, [], 0);
      if (!actions.length) { AIQ.toast({ type: 'warn', text: '先拖几块积木搭个程序吧' }); return; }
      running = true;
      /* 给自动化测试一个可读的状态位：跑完了没有。
         没有这个位，测试只能靠「猜等多久」——曾经因此误判四关都没通关。 */
      global.__labRunning = true;
      var i = 0, steps = 0;
      var lineEls = AIQ.qsa('.mb-line', mirror);
      var lit = 0;
      lineEls.forEach(function (x) { x.classList.remove('is-lit', 'is-now'); });

      /* 逐行亮起：亮过的行**保持亮着**，让整本书跟着程序一起「读完」。
         不能每帧清空 —— 那样只有当前一行亮，孩子看不出「程序读到哪了」。 */
      function lightLine() {
        if (lineEls[lit]) {
          lineEls[lit].classList.add('is-lit');
          lineEls[lit].classList.add('is-now');
        }
        if (lit > 0 && lineEls[lit - 1]) lineEls[lit - 1].classList.remove('is-now');
        lit++;
      }

      /* 求值一个布尔传感器。感知积木本身不产生动作，只回答「真 / 假」。 */
      function sense(cond, st) {
        var nr = st.r + DIRS[st.dir][0], nc = st.c + DIRS[st.dir][1];
        var hit = nr < 0 || nr >= L.rows || nc < 0 || nc >= L.cols ||
          (L.walls || []).some(function (w) { return w[0] === nr && w[1] === nc; });
        if (cond === 'wall') return hit;
        return false;
      }
      /* 走到哪就收到哪：苹果、道具、机关都算「踩到了」 */
      function autoTake() {
        var got = 0, platesLit = 0;
        (L.apples || []).forEach(function (ap) {
          var k = ap.r + ',' + ap.c;
          if (!state.got[k] && state.r === ap.r && state.c === ap.c) { state.got[k] = true; got++; }
        });
        (L.items || []).forEach(function (it) {
          var k = 'item' + it.r + it.c;
          if (!state.got[k] && state.r === it.r && state.c === it.c) { state.got[k] = true; got++; }
        });
        /* 机关（压力板）：踩上去就亮，这是第 1 关的核心玩法 */
        (L.plates || []).forEach(function (p) {
          var k = p.r + ',' + p.c;
          if (!state.got[k] && state.r === p.r && state.c === p.c) { state.got[k] = true; got++; platesLit++; }
        });
        if (platesLit) {
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play('chime');
          var leftP = (L.plates || []).filter(function (q) { return !state.got[q.r + ',' + q.c]; }).length;
          status.textContent = leftP ? ('🔆 机关亮了一个！还剩 ' + leftP + ' 个。') : '🔆 三个机关全亮了，去终点吧！';
          asst('机关进度', leftP ? ('点亮机关：还剩 ' + leftP + ' 个，继续按次序走。') : '机关全亮了，现在往终点走。');
        }
        if (got) {
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play('ding');
          var leftA = (L.apples || []).filter(function (x) { return !state.got[x.r + ',' + x.c]; }).length;
          status.textContent = leftA ? ('🍎 摘到一个！还剩 ' + leftA + ' 个苹果。') : '🍎 苹果全摘完啦！';
          if (!leftA) asst('苹果收齐', '苹果都摘到了，现在去终点。想一想：这一段路能不能用「重复」少拼几块？');
        }
      }

      /* 把一串动作排队执行：条件分支展开后要走的就是它 */
      function push(list) {
        for (var k = list.length - 1; k >= 0; k--) actions.splice(i, 0, list[k]);
      }

      function tick() {
        if (i >= actions.length) { finish('程序跑完啦'); return; }
        steps++;
        if (steps > 300) { finish('步骤太多，先停下来'); return; }
        var a = actions[i++];
        lightLine();
        var nr = state.r + DIRS[state.dir][0], nc = state.c + DIRS[state.dir][1];
        var blocked = nr < 0 || nr >= L.rows || nc < 0 || nc >= L.cols ||
          (L.walls || []).some(function (w) { return w[0] === nr && w[1] === nc; });

        if (a.type === 'event') {
          /* 事件积木：亮一下「当绿旗被按下」，表示程序从这里开始 */
          status.textContent = '🚩 ' + a.name + ' —— 程序开始执行';
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play('chime');
        } else if (a.type === 'repeatEmpty') {
          status.textContent = '🔁 「重复」里面还是空的，把它要重复的积木拖进去哦。';
        } else if (a.type === 'branch') {
          /* 条件分支：先求值，再决定要不要执行分支体 */
          var yes = sense(a.cond, state);
          status.textContent = (yes ? '✅ ' : '⬜ ') + '判断「' + senseName(a.cond) + '」→ ' +
            (yes ? '成立，执行里面的积木' : '不成立，跳过');
          if (yes) push(a.body);
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play(yes ? 'ding' : 'pop');
        } else if (a.type === 'move') {
          if (blocked) {
            /* 撞墙：哎哟一声 + 弹一下 + 呆毛耷拉 */
            state.mood = 'ouch';
            draw(state);
            if (typeof SFX !== 'undefined' && SFX.play) SFX.play('soft');
            status.textContent = '😣 哎哟！撞到啦。检查一下步数或转弯角度 —— 也可以用「前方有墙？」先判断。';
            Say.say('哎哟，撞到啦。先转弯，再往前走。');
            asst('撞墙提示', '前方有墙，试试「左转」或「右转」指令；或者用「如果 前方有墙 就 右转」让它自己判断。');
            markError(lit);
            running = false;
            global.__labRunning = false;
            global.setTimeout(function () { state.mood = 'happy'; draw(state); }, 700);
            return;
          }
          state.r = nr; state.c = nc;
          state.mood = 'happy';
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play('page');
          /* 走过苹果就自动摘掉 —— 低幼孩子不该为「捡东西」再多学一块积木。
             「收集」积木留给「站在原地把这一格的东西收进背包」这种用法。 */
          autoTake();
        } else if (a.type === 'left') { state.dir = (state.dir + 3) % 4; if (typeof SFX !== 'undefined' && SFX.play) SFX.play('pop'); }
        else if (a.type === 'right') { state.dir = (state.dir + 1) % 4; if (typeof SFX !== 'undefined' && SFX.play) SFX.play('pop'); }
        else if (a.type === 'pick') {
          /* 「收集」= 把脚下这一格的东西收进背包。
             苹果走过去就自动摘了，所以这块主要用在「道具（梯子 / 电池）」上。 */
          var before = Object.keys(state.got).length;
          autoTake();
          if (L.item && state.r === L.item.r && state.c === L.item.c && !state.itemTaken) {
            state.carrying = true; state.itemTaken = true;
            if (typeof SFX !== 'undefined' && SFX.play) SFX.play('ding');
          } else if (Object.keys(state.got).length === before) {
            status.textContent = '这一格没有可以收集的东西，再往前走走看。';
          }
        } else if (a.type === 'drop') {
          state.carrying = false;
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play('pop');
        }

        /* 星星（老关卡在用） */
        (L.stars || []).forEach(function (s) {
          var k = s.r + ',' + s.c;
          if (!state.got[k] && state.r === s.r && state.c === s.c) {
            state.got[k] = true;
            if (typeof SFX !== 'undefined' && SFX.play) SFX.play('star');
          }
        });
        paintStars(state, L);
        /* 每执行完一步都检查一次通关条件。
           注意：判定必须放在「每一步之后」，不能放在「前进指令里」——
           否则机器人原地转个身就站上终点、或者最后一步是转向时，通关都触发不了。 */
        var atGoal = (state.r === L.goal.r && state.c === L.goal.c);
        var platesLeft = (L.plates || []).filter(function (p) { return !state.got[p.r + ',' + p.c]; });
        var applesLeft = (L.apples || []).filter(function (x) { return !state.got[x.r + ',' + x.c]; });
        if (atGoal && !platesLeft.length && !applesLeft.length) {
          state.mood = 'win';
          draw(state);
          if (typeof SFX !== 'undefined' && SFX.play) SFX.play('cheer');
          finish('🎉 通关！所有目标都完成啦！');
          win();
          return;
        }
        if (atGoal && (platesLeft.length || applesLeft.length)) {
          if (platesLeft.length) {
            status.textContent = '到终点啦，但还有 ' + platesLeft.length + ' 个机关没踩亮 —— 回去把机关全踩一遍。';
            asst('还差机关', '还有 ' + platesLeft.length + ' 个机关没亮，按次序去踩它们。');
          } else {
            status.textContent = '到终点啦，但还有 ' + applesLeft.length + ' 个苹果没摘 —— 用「重复」把路再走一遍。';
            asst('还差苹果', '还有 ' + applesLeft.length + ' 个苹果没摘，把路再走一遍。');
          }
        }
        global.setTimeout(tick, 320);
      }
      tick();

      function finish(msg) {
        running = false;
        global.__labRunning = false;
        if (msg) status.textContent = msg;
      }
      function paintStars(st, LL) {
        var bits = [];
        var pl = LL.plates || [];
        if (pl.length) bits.push('🔆 机关 ' + pl.filter(function (p) { return st.got[p.r + ',' + p.c]; }).length + ' / ' + pl.length);
        var ap = LL.apples || [];
        if (ap.length) bits.push('🍎 苹果 ' + ap.filter(function (x) { return st.got[x.r + ',' + x.c]; }).length + ' / ' + ap.length);
        var starsN = (LL.stars || []).length;
        if (starsN) bits.push('⭐ ' + (LL.stars || []).filter(function (s) { return st.got[s.r + ',' + s.c]; }).length + ' / ' + starsN);
        starBar.textContent = bits.join('　');
      }
      function win() {
        Say.say('太棒啦！小AI 到家了。你成功啦！');
        /* 通关后把这一关记进 done，并重画任务卡 —— 下一关就解锁了 */
        done[L.story] = true;
        paintLevels();
        badge(L);
        api('/api/event', {
          method: 'POST',
          body: { type: 'code', title: '积木闯关：' + L.story, score: 100, xp: 12 }
        }).then(function () {
          AIQ.toast({ type: 'ok', title: '闯关成功', text: '已记录本次编程实践 +12 经验' });
        }).catch(function () {});
      }
    }

    /* ---------- 小AI 助手 ----------
     * 它不是装饰：孩子卡住时给一句「下一步该想什么」，
     * 而且提示的是**思维方式**（用循环 / 用条件），不是直接给答案。
     */
    var asstBubble = el('div', { class: 'asst-bubble' });
    var asstText = el('div', { class: 'asst-text', text: '我是小AI 助手。搭好积木点「运行」，我会在旁边看着，有困难就提醒你。' });
    function asst(title, msg) {
      AIQ.clear(asstBubble);
      asstBubble.appendChild(el('b', { class: 'asst-title', text: '💡 ' + title }));
      asstBubble.appendChild(el('div', { class: 'asst-msg', text: msg }));
      asstBubble.classList.remove('is-pop');
      /* 强制重排，让动画能重新播一次 */
      void asstBubble.offsetWidth;
      asstBubble.classList.add('is-pop');
      var t = qs('.asst-text', asstBubble);
      if (t) t.textContent = msg;
    }
    /* 出错时把「出错的那一行代码」标红 —— 让孩子把错误和代码位置对上。
       行号由调用方传进来：lit 是 run() 里的局部变量，这里取不到。 */
    function markError(which) {
      var lines = AIQ.qsa('.mb-line', mirror);
      var at = Math.max(0, Math.min(lines.length - 1, (which === undefined ? lines.length : which) - 1));
      if (!lines[at]) return;
      lines[at].classList.add('is-err');
      global.setTimeout(function () { lines[at].classList.remove('is-err'); }, 2600);
    }

    /* ---------- 通关徽章 ---------- */
    function badge(L) {
      /* 先清掉可能还在的旧徽章，免得叠成一堆 */
      document.querySelectorAll('.win-badge').forEach(function (x) { x.remove(); });
      var box = el('div', { class: 'win-badge' }, [
        el('div', { class: 'wb-glow' }),
        el('div', { class: 'wb-medal', text: L.emoji }),
        el('b', { class: 'wb-title', text: '通关！' }),
        el('div', { class: 'wb-sub', text: L.story }),
        el('div', { class: 'wb-learn', text: '你学会了：' + L.learn }),
        el('button', {
          class: 'btn btn-run btn-sm', type: 'button', text: '下一关 →',
          onclick: function () {
            box.remove();
            var next = Math.min(VISIBLE.length - 1, levelIndex + 1);
            if (next === levelIndex) { AIQ.toast({ type: 'ok', text: '这个学段的关卡都通关啦！真厉害 🎉' }); return; }
            AIQ.qsa('.quest-card', levelRow)[next].click();
          }
        })
      ]);
      /* 彩带：纯 CSS 画的小纸片，不用任何素材 */
      var conf = el('div', { class: 'win-confetti' });
      for (var i = 0; i < 18; i++) {
        conf.appendChild(el('i', {
          style: {
            left: (Math.random() * 100).toFixed(1) + '%',
            background: ['#ffd76a', '#8fd86a', '#9fd4f5', '#ffb0c8', '#d6c4f7'][i % 5],
            animationDelay: (Math.random() * 0.6).toFixed(2) + 's',
            animationDuration: (1.4 + Math.random() * 0.8).toFixed(2) + 's'
          }
        }));
      }
      box.appendChild(conf);
      document.body.appendChild(box);
      if (typeof SFX !== 'undefined' && SFX.play) { SFX.play('cheer'); global.setTimeout(function () { SFX.play('star'); }, 260); }
      global.setTimeout(function () { if (box.parentNode) box.remove(); }, 6000);
    }

    /* ---------- 组装界面 ---------- */
    stageBox.appendChild(el('div', { class: 'asst-panel' }, [
      el('div', { class: 'asst-face', text: '🤖' }),
      el('div', { class: 'asst-body' }, [asstText, asstBubble])
    ]));
    stageBox.appendChild(el('div', { class: 'btn-row stage-actions' }, [
      el('button', { class: 'btn btn-run', type: 'button', text: '▶ 运行', onclick: function () { run(); } }),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '重置', onclick: function () { running = false; reset(); renderScript(); } }),
      el('button', {
        class: 'btn btn-ghost btn-sm' + (Say.isEnabled() ? ' is-on' : ''), type: 'button', id: 'say-btn',
        text: '🔊 语音', title: '朗读开关（给不识字的小朋友）',
        onclick: function (e) {
          Say.setEnabled(!Say.isEnabled());
          e.currentTarget.classList.toggle('is-on', Say.isEnabled());
          AIQ.toast({ type: 'info', text: Say.isEnabled() ? '语音提示已打开' : '语音提示已关闭' });
        }
      }),
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', text: '给我看一条参考路线',
        onclick: function () {
          /* 参考路线存在关卡数据里（L.ref），而且都被 tests/maze.test.js 用 BFS 验证过。
             千万不要在这里另写一份 —— 之前就是两处各写一份，改了一处忘了另一处，
             结果「参考路线」自己撞墙。 */
          var ref = VISIBLE[levelIndex].ref || [];
          blocks = JSON.parse(JSON.stringify(ref));
          blocks.forEach(function fix(n) { n.id = AIQ.uid('b'); if (n.body) n.body.forEach(fix); });
          resetScope(); renderScript();
          status.textContent = '这是其中一种走法，点「运行」看看效果 —— 也可以自己换一种。';
        }
      })
    ]));
    stageBox.appendChild(svgHolder);
    stageBox.appendChild(starBar);
    stageBox.appendChild(status);

    host.appendChild(el('div', { class: 'tier-note' }, [
      el('span', { class: 'tier-badge', text: depthOf() <= 2 ? '低年级' : (depthOf() === 3 ? '中年级' : '高年级') }),
      el('span', { text: tier.tip })
    ]));
    host.appendChild(el('div', { class: 'quest-card-row' }, [levelRow]));
    host.appendChild(headBox);
    host.appendChild(el('div', { class: 'lab-layout game-layout' }, [
      el('div', {}, [
        el('div', { class: 'panel' }, [
          el('h3', { text: '🎒 指令背包' }),
          el('p', { class: 'small muted', text: '拖到右边，或者点一下。' }),
          poolBox,
          el('p', { class: 'sense-tip', text: '下面是「判断条件」，只能拖进「如果…就…」的槽里：' }),
          senseBox
        ])
      ]),
      el('div', {}, [
        el('div', { class: 'panel' }, [el('h3', { text: '🗺️ 闯关地图' }), stageBox]),
        el('div', { class: 'panel' }, [
          el('h3', { text: '🧩 我的程序' }),
          scriptBox,
          el('div', { class: 'code-translate' }, [
            el('div', { class: 'mb-head', text: '📖 魔法书：积木变成 Python' }),
            mirror
          ]),
          el('div', { class: 'btn-row' }, [
            el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '清空重来', onclick: function () { blocks = []; resetScope(); renderScript(); } })
          ])
        ])
      ])
    ]));
    reset();
    renderScript();
  }

  /* ================================================================
   * 四、代码实验室（Python / JavaScript）
   * ================================================================ */
  var EXAMPLES = {
    python: [
      {
        name: '① 变量与输出',
        code: '# 用变量记住信息，再打印出来\nname = "小启"\nage = 9\nprint("大家好，我是", name)\nprint("我今年", age, "岁")\nprint("明年我就", age + 1, "岁了")'
      },
      {
        name: '② 用循环画图形',
        code: '# 用循环重复画同一个图形\npenColor("#1f6f5c")\npenSize(3)\n\nfor i in range(5):\n    circle(60 + i * 45, 100, 20)\n\nprint("画了 5 个圆")'
      },
      {
        name: '③ 条件判断',
        code: '# 根据条件做不同的决定\nscore = 86\n\nif score >= 90:\n    print("优秀")\nelif score >= 60:\n    print("及格")\nelse:\n    print("再努力一下")'
      },
      {
        name: '④ 列表与统计',
        code: '# 列表可以存一组数据\nscores = [88, 92, 75, 96, 60]\nprint("共有", len(scores), "个成绩")\nprint("总分", sum(scores))\nprint("平均", sum(scores) / len(scores))\nprint("最高", max(scores))\nprint("排序后", sorted(scores))'
      },
      {
        name: '⑤ 函数与复用',
        code: '# 把一段功能打包成函数\ndef average(a, b):\n    return (a + b) / 2\n\nprint(average(80, 90))\nprint(average(88, 96))\n\n# 函数里也可以用循环\ndef draw_row(n):\n    for i in range(n):\n        circle(40 + i * 35, 150, 14)\n\ndraw_row(6)'
      },
      {
        name: '⑥ 画一条螺旋',
        code: '# 循环 + 变量 = 越来越大的螺旋\npenColor("#c98a1b")\npenSize(2)\nmoveTo(150, 150)\n\nsize = 6\nfor i in range(40):\n    lineTo(150 + size, 150)\n    size = size + 4\n\nprint("螺旋画好了")'
      },
      {
        name: '⑦ 梯度下降的一步步逼近',
        code: '# 用循环模拟机器学习里的梯度下降\nw = 0.1          # 一开始随便猜一个参数\nfor step in range(12):\n    error = 10 * (w - 0.8)      # 误差：离目标 0.8 有多远\n    grad = 20 * (w - 0.8)       # 梯度：误差的增长方向\n    w = w - 0.12 * grad         # 往误差更小的方向挪一小步\n    print("第", step + 1, "步  w =", round(w, 3), " 误差 =", round(error, 3))\n\nprint("最后 w ≈", round(w, 3), "，已经很接近目标 0.8 了")'
      }
    ],
    js: [
      {
        name: '① 变量与输出',
        code: '// JavaScript 版本\nvar name = "小启";\nvar age = 9;\nprint("大家好，我是 " + name);\nprint("我今年 " + age + " 岁");\nprint("明年我 " + (age + 1) + " 岁");'
      },
      {
        name: '② 用循环画图形',
        code: '// 循环重复画圆\npenColor("#2b7fb8");\npenSize(3);\nvar i;\nfor (i = 0; i < 5; i = i + 1) {\n  circle(60 + i * 45, 100, 20);\n}\nprint("画了 5 个圆");'
      },
      {
        name: '③ 条件判断',
        code: 'var score = 86;\nif (score >= 90) {\n  print("优秀");\n} else if (score >= 60) {\n  print("及格");\n} else {\n  print("再努力一下");\n}'
      },
      {
        name: '④ 列表与统计',
        code: 'var scores = [88, 92, 75, 96, 60];\nprint("共有 " + len(scores) + " 个成绩");\nprint("总分 " + sum(scores));\nprint("平均 " + (sum(scores) / len(scores)));\nprint("最高 " + max(scores));'
      },
      {
        name: '⑤ 函数与复用',
        code: 'function average(a, b) {\n  return (a + b) / 2;\n}\nprint(average(80, 90));\nprint(average(88, 96));\n\nfunction drawRow(n) {\n  var i;\n  for (i = 0; i < n; i = i + 1) {\n    circle(40 + i * 35, 150, 14);\n  }\n}\ndrawRow(6);'
      },
      {
        name: '⑥ 画一条螺旋',
        code: 'penColor("#c98a1b");\npenSize(2);\nmoveTo(150, 150);\nvar size = 6;\nvar i;\nfor (i = 0; i < 40; i = i + 1) {\n  lineTo(150 + size, 150);\n  size = size + 4;\n}\nprint("螺旋画好了");'
      }
    ]
  };

  function renderCodeLab(host) {
    var lang = 'python';
    var stage = DrawStage();
    var editor = el('textarea', { class: 'code-editor', spellcheck: 'false' });
    var consoleBox = el('div', { class: 'code-console', html: '<span class="di">控制台输出会显示在这里。</span>' });
    var exampleRow = el('div', { class: 'mode-picker' });
    var langRow = el('div', { class: 'mode-picker' });

    function setLang(l) {
      lang = l;
      AIQ.qsa('.filter-chip', langRow).forEach(function (x) { x.classList.toggle('is-on', x.dataset.lang === lang); });
      renderExamples();
      editor.value = EXAMPLES[lang][0].code;
    }
    function renderExamples() {
      AIQ.clear(exampleRow);
      EXAMPLES[lang].forEach(function (ex, i) {
        exampleRow.appendChild(el('button', {
          class: 'filter-chip' + (i === 0 ? ' is-on' : ''), type: 'button', text: ex.name,
          onclick: function (ev) {
            AIQ.qsa('.filter-chip', exampleRow).forEach(function (x) { x.classList.remove('is-on'); });
            ev.currentTarget.classList.add('is-on');
            editor.value = ex.code;
            stage.clear();
            consoleBox.innerHTML = '<span class="di">已载入示例，按「运行」看看结果。</span>';
          }
        }));
      });
    }
    ['python', 'js'].forEach(function (l) {
      langRow.appendChild(el('button', {
        class: 'filter-chip' + (l === lang ? ' is-on' : ''), type: 'button', 'data-lang': l,
        text: l === 'python' ? '🐍 Python' : '⚡ JavaScript',
        onclick: function () { setLang(l); }
      }));
    });

    function printLine(text, cls) {
      consoleBox.appendChild(el('div', { class: cls || '', text: text }));
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }

    function run() {
      var code = editor.value;
      stage.clear();
      AIQ.clear(consoleBox);
      var t0 = Date.now();
      if (lang === 'python') {
        try {
          var interp = new MiniPy.Interp({ ctx: stage, maxSteps: 4000, maxMs: 2500 });
          var out = interp.run(code);
          if (!out.length) printLine('（程序运行完成，没有输出。可以试试 print 一些内容）', 'di');
          else out.forEach(function (line) { printLine(line, 'ok'); });
          printLine('✓ 运行成功（' + (Date.now() - t0) + ' ms）', 'di');
          report('Python', true);
        } catch (e) {
          printLine('✗ ' + e.message, 'er');
          if (!e.isMiniPy) printLine('提示：这一版解释器支持 print、变量、算术、if/elif/else、for range/列表、while、def、列表与字符串常用方法。', 'di');
          report('Python', false);
        }
      } else {
        try {
          var lines = [];
          var api = {
            print: function () { printLine(Array.prototype.slice.call(arguments).map(function (v) { return Array.isArray(v) ? '[' + v.join(', ') + ']' : String(v); }).join(' '), 'ok'); },
            len: function (v) { return v && v.length ? v.length : 0; },
            sum: function (v) { return (v || []).reduce(function (a, b) { return a + b; }, 0); },
            max: function (v) { return Math.max.apply(null, Array.isArray(v) ? v : arguments); },
            min: function (v) { return Math.min.apply(null, Array.isArray(v) ? v : arguments); },
            abs: Math.abs, str: String, int: function (v) { return parseInt(v, 10) || 0; },
            round: function (v, digits) { var f = Math.pow(10, digits === undefined ? 0 : Number(digits)); return Math.round(Number(v) * f) / f; },
            moveTo: stage.moveTo, lineTo: stage.lineTo, circle: stage.circle, rect: stage.rect,
            dot: stage.dot, penColor: stage.penColor, penSize: stage.penSize, clear: stage.clear
          };
          if (/while\s*\(\s*(true|1)\s*\)/.test(code) && !/break/.test(code)) {
            throw new Error('检测到没有 break 的死循环，已拒绝执行，避免页面卡住。');
          }
          var fn = new Function('print', 'len', 'sum', 'max', 'min', 'abs', 'round', 'str', 'int',
            'moveTo', 'lineTo', 'circle', 'rect', 'dot', 'penColor', 'penSize', 'clear',
            '"use strict";\n' + code);
          fn(api.print, api.len, api.sum, api.max, api.min, api.abs, api.round, api.str, api.int,
            api.moveTo, api.lineTo, api.circle, api.rect, api.dot, api.penColor, api.penSize, api.clear);
          printLine('✓ 运行成功（' + (Date.now() - t0) + ' ms）', 'di');
          report('JavaScript', true);
        } catch (e) {
          var msg = e.message || String(e);
          if (/is not defined/.test(msg)) msg = '用到了还没有定义的变量或函数：' + msg;
          printLine('✗ ' + msg, 'er');
          report('JavaScript', false);
        }
      }
      function report(langName, ok) {
        if (!ok) return;
        api('/api/event', { method: 'POST', body: { type: 'code', title: langName + ' 代码运行成功', xp: 8 } })
          .then(function () { AIQ.toast({ type: 'ok', text: '运行成功，已记录 +8 经验' }); })
          .catch(function () {});
      }
    }

    host.appendChild(el('div', { class: 'lab-layout' }, [
      el('div', {}, [
        el('div', { class: 'panel' }, [el('h3', { text: '语言' }), langRow,
          el('p', { class: 'small muted', text: 'Python 用的是内置的教学用迷你解释器，支持常用语法与死循环保护；JavaScript 在沙箱里运行。' })]),
        el('div', { class: 'panel' }, [el('h3', { text: '示例程序' }), exampleRow]),
        el('div', { class: 'panel' }, [
          el('h3', { text: '绘图 API 速查' }),
          el('ul', { class: 'ask-list' }, [
            el('li', { text: 'moveTo(x, y)　把笔移到坐标点' }),
            el('li', { text: 'lineTo(x, y)　从当前位置画线过去' }),
            el('li', { text: 'circle(x, y, r)　画圆' }),
            el('li', { text: 'rect(x, y, w, h)　画矩形' }),
            el('li', { text: 'penColor("颜色") / penSize(粗细)' }),
            el('li', { text: 'clear()　清空画布' })
          ])
        ])
      ]),
      el('div', {}, [
        el('div', { class: 'panel' }, [
          el('div', { class: 'panel-head' }, [
            el('h3', { text: '代码' }),
            el('div', { class: 'panel-tools' }, [
              el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '▶ 运行（Ctrl+Enter）', onclick: run }),
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '清空画布', onclick: function () { stage.clear(); } })
            ])
          ]),
          editor,
          el('div', { class: 'draw-stage', style: { marginTop: '12px', maxWidth: '340px' } }, [stage.svg]),
          consoleBox
        ])
      ])
    ]));

    editor.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = editor.selectionStart;
        editor.value = editor.value.slice(0, s) + '    ' + editor.value.slice(editor.selectionEnd);
        editor.selectionStart = editor.selectionEnd = s + 4;
      }
    });

    setLang('python');
  }

  /* ================================================================
   * 五、AI 实践任务卡
   * ================================================================ */
  var TASKS = [
    {
      id: 'gd', name: '任务一：用循环实现梯度下降', emoji: '📉', lang: 'python',
      brief: '不给公式，只用一个循环，让参数一步步逼近目标值。体会「机器学习就是在减小误差」。',
      checks: ['每轮打印参数与误差', '误差逐轮变小', '最后参数接近目标 0.8'],
      code: '# 目标：让 w 从 0.1 逼近 0.8\n# 提示：每一轮算出误差，再沿误差变小的方向调整 w\nw = 0.1\ntarget = 0.8\n\nfor step in range(12):\n    error = w - target          # 现在离目标差多少\n    w = w - 0.12 * error * 20   # TODO: 试着调整这一行的系数，看收敛快慢\n    print("第", step + 1, "步 w =", round(w, 3))\n\nprint("最终 w =", round(w, 3))'
    },
    {
      id: 'rule', name: '任务二：写一个规则分类器', emoji: '🧮', lang: 'python',
      brief: '用 if / elif 写一个「垃圾短信识别器」：包含关键词就判为可疑，否则正常。这是最早期的分类方法。',
      checks: ['至少用到 3 个关键词', '对 5 条测试短信给出判断', '说明规则法的局限'],
      code: '# 规则分类器：人写规则，机器照做\nsms = "恭喜您中奖！点击链接领取 999 元大奖"\n\nkeywords = ["中奖", "点击链接", "免费领取", "转账"]\n\nhit = 0\nfor word in keywords:\n    if word in sms:\n        hit = hit + 1\n\nif hit >= 2:\n    print("可疑短信")\nelif hit == 1:\n    print("需要留意")\nelse:\n    print("正常短信")\n\n# 想一想：如果骗子换个说法，这个规则还管用吗？'
    },
    {
      id: 'knn', name: '任务三：k 近邻投票（简化版）', emoji: '🗳️', lang: 'python',
      brief: '把「看邻居投票」这件事用循环写出来：找出最像的邻居，按它们的标签决定新样本的类别。',
      checks: ['能算出相似度', '选出最近的 3 个邻居', '按多数票给出类别'],
      code: '# 简化的最近邻投票\n# 每个样本有两个特征（x1, x2）和一个标签\ndata = [\n    [1, 1, 0],\n    [1.2, 0.9, 0],\n    [3, 3, 1],\n    [3.2, 2.8, 1],\n    [1.1, 1.3, 0],\n    [2.9, 3.1, 1]\n]\nnew_point = [1.1, 1.2]\n\n# 计算每个样本到新点的距离\nbest = None\nbest_dist = 999\nfor row in data:\n    dx = row[0] - new_point[0]\n    dy = row[1] - new_point[1]\n    dist = dx * dx + dy * dy\n    print("样本", row, "距离平方 =", round(dist, 3))\n    if dist < best_dist:\n        best_dist = dist\n        best = row\n\nprint("最近的邻居是", best)\nprint("所以新样本的类别是", best[2])'
    }
  ];

  function renderTasks(host) {
    var grid = el('div', { class: 'task-cards' });
    TASKS.forEach(function (t) {
      grid.appendChild(el('article', { class: 'task-card' }, [
        el('div', { style: { fontSize: '24px' }, text: t.emoji }),
        el('b', { text: t.name }),
        el('p', { class: 'small muted', text: t.brief }),
        el('ul', { class: 'ask-list' }, t.checks.map(function (c) { return el('li', { text: '检查点：' + c }); })),
        el('div', { class: 'btn-row', style: { marginTop: '10px' } }, [
          el('button', {
            class: 'btn btn-primary btn-sm', type: 'button', text: '在代码实验室里打开',
            onclick: function () {
              var labHost = qs('#code-stage');
              AIQ.clear(labHost);
              renderCodeLab(labHost);
              setTimeout(function () {
                var ed = qs('.code-editor');
                if (ed) {
                  ed.value = t.code;
                  ed.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  AIQ.toast({ type: 'ok', title: '已载入任务代码', text: '按 Ctrl+Enter 运行，然后按检查点自己改一改' });
                }
              }, 60);
            }
          })
        ])
      ]));
    });
    host.appendChild(el('div', { class: 'panel' }, [
      el('h3', { text: '三个能把「AI 原理」写出来的小任务' }),
      el('p', { class: 'muted', text: '这三个任务把前面学到的概念变成可以运行的代码：误差、规则、相似度、投票。' +
        '不用怕写错——解释器会告诉你哪一行有问题。' })
    ]));
    host.appendChild(grid);
  }

  /* ================================================================
   * 六、启动
   * ================================================================ */
  function init() {
    var stage = qs('#code-stage');
    var tabs = qs('#code-tabs');
    var desc = qs('#lab-desc');
    if (!stage || !tabs) return;
    var descMap = {
      maze: '拖积木或点积木搭程序，让机器人走到终点；右侧会实时把积木翻译成 Python 代码。',
      python: '用 Python（内置教学用迷你解释器）写程序，可以真的画图，也有死循环保护。',
      js: 'JavaScript 沙箱环境，绘图 API 与 Python 侧一致，方便对比两种语言。',
      tasks: '三个把 AI 原理写成代码的小任务，点开就能直接在代码实验室里运行和修改。'
    };
    function show(lab) {
      AIQ.clear(stage);
      if (desc) desc.textContent = descMap[lab] || '';
      if (lab === 'maze') renderMaze(stage);
      else if (lab === 'tasks') renderTasks(stage);
      else renderCodeLab(stage);
    }
    AIQ.qsa('.tab', tabs).forEach(function (btn) {
      AIQ.on(btn, 'click', function () {
        AIQ.qsa('.tab', tabs).forEach(function (x) { x.classList.toggle('is-on', x === btn); });
        show(btn.dataset.lab);
      });
    });
    show('maze');
  }

  AIQ.ready(init);
  global.AIQLab = { MiniPy: MiniPy };
})(window);
