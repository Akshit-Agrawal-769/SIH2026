!(function() {
  "use strict";
  const { Array: t, Object: n, Number: e, Math: s, Error: r, Uint8Array: o, Uint16Array: c, Uint32Array: i, Int32Array: a, Map: f, DataView: u, Promise: l, TextEncoder: w, crypto: h, postMessage: p, TransformStream: d, ReadableStream: y, WritableStream: m, CompressionStream: S, DecompressionStream: g } = self, v = void 0, b = "undefined", k = "function", z = new o(), C = [[], [], [], [], [], [], [], []];
  for (let t2 = 0; t2 < 256; t2++) {
    let n2 = t2;
    for (let t3 = 0; t3 < 8; t3++) n2 = 1 & n2 ? n2 >>> 1 ^ 3988292384 : n2 >>> 1;
    C[0][t2] = n2;
  }
  for (let t2 = 0; t2 < 256; t2++) for (let n2 = 1; n2 < 8; n2++) {
    const e2 = C[n2 - 1][t2];
    C[n2][t2] = e2 >>> 8 ^ C[0][255 & e2];
  }
  const [I, A, x, M, P, B, D, F] = C;
  class R {
    constructor(t2) {
      this.o = t2 || -1;
    }
    append(t2) {
      let n2 = 0 | this.o;
      const e2 = 0 | t2.length;
      let s2 = 0;
      if (e2 >= 8 && t2.buffer) {
        const r2 = new u(t2.buffer, t2.byteOffset, e2), o2 = e2 - 8;
        for (; s2 <= o2; s2 += 8) {
          const t3 = n2 ^ r2.getInt32(s2, true), e3 = r2.getInt32(s2 + 4, true);
          n2 = F[255 & t3] ^ D[t3 >>> 8 & 255] ^ B[t3 >>> 16 & 255] ^ P[t3 >>> 24 & 255] ^ M[255 & e3] ^ x[e3 >>> 8 & 255] ^ A[e3 >>> 16 & 255] ^ I[e3 >>> 24 & 255];
        }
      }
      for (; s2 < e2; s2++) n2 = n2 >>> 8 ^ I[255 & (n2 ^ t2[s2])];
      this.o = n2;
    }
    get() {
      return ~this.o;
    }
  }
  class U extends d {
    constructor() {
      let t2;
      const n2 = new R();
      super({ transform(t3, e2) {
        n2.append(t3), e2.enqueue(t3);
      }, flush() {
        const e2 = new o(4);
        new u(e2.buffer).setUint32(0, n2.get()), t2.value = e2;
      } }), t2 = this;
    }
  }
  function W(t2, n2) {
    const e2 = new o(t2.length + n2.length);
    return e2.set(t2), e2.set(n2, t2.length), e2;
  }
  function _(t2) {
    return new u(t2.buffer, t2.byteOffset, t2.byteLength);
  }
  const T = { concat(t2, n2) {
    if (0 === t2.length || 0 === n2.length) return t2.concat(n2);
    const e2 = t2[t2.length - 1], s2 = T.l(e2);
    return 32 === s2 ? t2.concat(n2) : T.h(n2, s2, 0 | e2, t2.slice(0, t2.length - 1));
  }, bitLength(t2) {
    const n2 = t2.length;
    if (0 === n2) return 0;
    const e2 = t2[n2 - 1];
    return 32 * (n2 - 1) + T.l(e2);
  }, m(t2, n2) {
    if (32 * t2.length < n2) return t2;
    const e2 = (t2 = t2.slice(0, s.ceil(n2 / 32))).length;
    return n2 &= 31, e2 > 0 && n2 && (t2[e2 - 1] = T.S(n2, t2[e2 - 1] & 2147483648 >> n2 - 1, 1)), t2;
  }, S: (t2, n2, e2) => 32 === t2 ? n2 : (e2 ? 0 | n2 : n2 << 32 - t2) + 1099511627776 * t2, l: (t2) => s.round(t2 / 1099511627776) || 32, h(t2, n2, e2, s2) {
    for (void 0 === s2 && (s2 = []); n2 >= 32; n2 -= 32) s2.push(e2), e2 = 0;
    if (0 === n2) return s2.concat(t2);
    for (let r3 = 0; r3 < t2.length; r3++) s2.push(e2 | t2[r3] >>> n2), e2 = t2[r3] << 32 - n2;
    const r2 = t2.length ? t2[t2.length - 1] : 0, o2 = T.l(r2);
    return s2.push(T.S(n2 + o2 & 31, n2 + o2 > 32 ? e2 : s2.pop(), 1)), s2;
  } }, V = { bytes: { v(t2) {
    const n2 = T.bitLength(t2) / 8, e2 = new o(n2);
    let s2;
    for (let r2 = 0; r2 < n2; r2++) 3 & r2 || (s2 = t2[r2 / 4]), e2[r2] = s2 >>> 24, s2 <<= 8;
    return e2;
  }, C(t2) {
    const n2 = [];
    let e2, s2 = 0;
    for (e2 = 0; e2 < t2.length; e2++) s2 = s2 << 8 | t2[e2], 3 & ~e2 || (n2.push(s2), s2 = 0);
    return 3 & e2 && n2.push(T.S(8 * (3 & e2), s2)), n2;
  } } }, K = class {
    constructor(t2) {
      const n2 = this;
      n2.blockSize = 512, n2.I = [1732584193, 4023233417, 2562383102, 271733878, 3285377520], n2.A = [1518500249, 1859775393, 2400959708, 3395469782], t2 ? (n2.M = t2.M.slice(0), n2.P = t2.P.slice(0), n2.B = t2.B) : n2.reset();
    }
    reset() {
      const t2 = this;
      return t2.M = t2.I.slice(0), t2.P = [], t2.B = 0, t2;
    }
    update(t2) {
      const n2 = this;
      "string" == typeof t2 && (t2 = V.D.C(t2));
      const e2 = n2.P = T.concat(n2.P, t2), s2 = n2.B, o2 = n2.B = s2 + T.bitLength(t2);
      if (o2 > 9007199254740991) throw new r("Cannot hash more than 2^53 - 1 bits");
      const c2 = new i(e2);
      let a2 = 0;
      for (let t3 = n2.blockSize + s2 - (n2.blockSize + s2 & n2.blockSize - 1); t3 <= o2; t3 += n2.blockSize) n2.F(c2.subarray(16 * a2, 16 * (a2 + 1))), a2 += 1;
      return e2.splice(0, 16 * a2), n2;
    }
    R() {
      const t2 = this;
      let n2 = t2.P;
      const e2 = t2.M;
      n2 = T.concat(n2, [T.S(1, 1)]);
      for (let t3 = n2.length + 2; 15 & t3; t3++) n2.push(0);
      for (n2.push(s.floor(t2.B / 4294967296)), n2.push(0 | t2.B); n2.length; ) t2.F(n2.splice(0, 16));
      return t2.reset(), e2;
    }
    U(t2, n2, e2, s2) {
      return t2 <= 19 ? n2 & e2 | ~n2 & s2 : t2 <= 39 ? n2 ^ e2 ^ s2 : t2 <= 59 ? n2 & e2 | n2 & s2 | e2 & s2 : t2 <= 79 ? n2 ^ e2 ^ s2 : void 0;
    }
    W(t2, n2) {
      return n2 << t2 | n2 >>> 32 - t2;
    }
    F(n2) {
      const e2 = this, r2 = e2.M, o2 = t(80);
      for (let t2 = 0; t2 < 16; t2++) o2[t2] = n2[t2];
      let c2 = r2[0], i2 = r2[1], a2 = r2[2], f2 = r2[3], u2 = r2[4];
      for (let t2 = 0; t2 <= 79; t2++) {
        t2 >= 16 && (o2[t2] = e2.W(1, o2[t2 - 3] ^ o2[t2 - 8] ^ o2[t2 - 14] ^ o2[t2 - 16]));
        const n3 = e2.W(5, c2) + e2.U(t2, i2, a2, f2) + u2 + o2[t2] + e2.A[s.floor(t2 / 20)] | 0;
        u2 = f2, f2 = a2, a2 = e2.W(30, i2), i2 = c2, c2 = n3;
      }
      r2[0] = r2[0] + c2 | 0, r2[1] = r2[1] + i2 | 0, r2[2] = r2[2] + a2 | 0, r2[3] = r2[3] + f2 | 0, r2[4] = r2[4] + u2 | 0;
    }
  }, E = { importKey: (t2) => new E._(V.bytes.C(t2)), T(t2, n2, e2, s2) {
    if (e2 = e2 || 1e4, s2 < 0 || e2 < 0) throw new r("invalid params to pbkdf2");
    const o2 = 1 + (s2 >> 5) << 2;
    let c2, i2, a2, f2, l2;
    const w2 = new ArrayBuffer(o2), h2 = new u(w2);
    let p2 = 0;
    const d2 = T;
    for (n2 = V.bytes.C(n2), l2 = 1; p2 < (o2 || 1); l2++) {
      for (c2 = i2 = t2.encrypt(d2.concat(n2, [l2])), a2 = 1; a2 < e2; a2++) for (i2 = t2.encrypt(i2), f2 = 0; f2 < i2.length; f2++) c2[f2] ^= i2[f2];
      for (a2 = 0; p2 < (o2 || 1) && a2 < c2.length; a2++) h2.setInt32(p2, c2[a2]), p2 += 4;
    }
    return w2.slice(0, s2 / 8);
  }, _: class {
    constructor(t2) {
      const n2 = this, e2 = n2.V = K, s2 = [[], []];
      n2.K = [new e2(), new e2()];
      const r2 = n2.K[0].blockSize / 32;
      t2.length > r2 && (t2 = new e2().update(t2).R());
      for (let n3 = 0; n3 < r2; n3++) s2[0][n3] = 909522486 ^ t2[n3], s2[1][n3] = 1549556828 ^ t2[n3];
      n2.K[0].update(s2[0]), n2.K[1].update(s2[1]), n2.L = new e2(n2.K[0]);
    }
    reset() {
      const t2 = this;
      t2.L = new t2.V(t2.K[0]), t2.O = false;
    }
    update(t2) {
      this.O = true, this.L.update(t2);
    }
    digest() {
      const t2 = this, n2 = t2.L.R(), e2 = new t2.V(t2.K[1]).update(n2).R();
      return t2.reset(), e2;
    }
    encrypt(t2) {
      if (this.O) throw new r("encrypt on already updated hmac called!");
      return this.update(t2), this.digest(t2);
    }
  } }, L = typeof h != b && typeof h.getRandomValues == k, O = "Invalid password", j = "Invalid signature", H = j, N = "zipjs-abort-check-password";
  function q(t2) {
    if (L) return h.getRandomValues(t2);
    throw new r("Crypto API not supported");
  }
  const G = 16, J = { name: "PBKDF2" }, Q = n.assign({ hash: { name: "HMAC" } }, J), X = n.assign({ iterations: 1e3, hash: { name: "SHA-1" } }, J), Y = ["deriveBits"], Z = [8, 12, 16], $ = [16, 24, 32], tt = 10, nt = [0, 0, 0, 0], et = typeof h != b, st = et && h.subtle, rt = et && typeof st != b, ot = V.bytes, ct = class {
    constructor(t2) {
      const n2 = this;
      n2.j = [[[], [], [], [], []], [[], [], [], [], []]], n2.j[0][0][0] || n2.H();
      const e2 = n2.j[0][4], s2 = n2.j[1], o2 = t2.length;
      let c2, i2, a2, f2 = 1;
      if (4 !== o2 && 6 !== o2 && 8 !== o2) throw new r("invalid aes key size");
      for (n2.A = [i2 = t2.slice(0), a2 = []], c2 = o2; c2 < 4 * o2 + 28; c2++) {
        let t3 = i2[c2 - 1];
        (c2 % o2 === 0 || 8 === o2 && c2 % o2 === 4) && (t3 = e2[t3 >>> 24] << 24 ^ e2[t3 >> 16 & 255] << 16 ^ e2[t3 >> 8 & 255] << 8 ^ e2[255 & t3], c2 % o2 === 0 && (t3 = t3 << 8 ^ t3 >>> 24 ^ f2 << 24, f2 = f2 << 1 ^ 283 * (f2 >> 7))), i2[c2] = i2[c2 - o2] ^ t3;
      }
      for (let t3 = 0; c2; t3++, c2--) {
        const n3 = i2[3 & t3 ? c2 : c2 - 4];
        a2[t3] = c2 <= 4 || t3 < 4 ? n3 : s2[0][e2[n3 >>> 24]] ^ s2[1][e2[n3 >> 16 & 255]] ^ s2[2][e2[n3 >> 8 & 255]] ^ s2[3][e2[255 & n3]];
      }
    }
    encrypt(t2) {
      return this.N(t2, 0);
    }
    decrypt(t2) {
      return this.N(t2, 1);
    }
    H() {
      const t2 = this.j[0], n2 = this.j[1], e2 = t2[4], s2 = n2[4], r2 = [], o2 = [];
      let c2, i2, a2, f2;
      for (let t3 = 0; t3 < 256; t3++) o2[(r2[t3] = t3 << 1 ^ 283 * (t3 >> 7)) ^ t3] = t3;
      for (let u2 = c2 = 0; !e2[u2]; u2 ^= i2 || 1, c2 = o2[c2] || 1) {
        let o3 = c2 ^ c2 << 1 ^ c2 << 2 ^ c2 << 3 ^ c2 << 4;
        o3 = o3 >> 8 ^ 255 & o3 ^ 99, e2[u2] = o3, s2[o3] = u2, f2 = r2[a2 = r2[i2 = r2[u2]]];
        let l2 = 16843009 * f2 ^ 65537 * a2 ^ 257 * i2 ^ 16843008 * u2, w2 = 257 * r2[o3] ^ 16843008 * o3;
        for (let e3 = 0; e3 < 4; e3++) t2[e3][u2] = w2 = w2 << 24 ^ w2 >>> 8, n2[e3][o3] = l2 = l2 << 24 ^ l2 >>> 8;
      }
      for (let e3 = 0; e3 < 5; e3++) t2[e3] = t2[e3].slice(0), n2[e3] = n2[e3].slice(0);
    }
    N(t2, n2) {
      if (4 !== t2.length) throw new r("invalid aes block size");
      const e2 = this.A[n2], s2 = e2.length / 4 - 2, o2 = [0, 0, 0, 0], c2 = this.j[n2], i2 = c2[0], a2 = c2[1], f2 = c2[2], u2 = c2[3], l2 = c2[4];
      let w2, h2, p2, d2 = t2[0] ^ e2[0], y2 = t2[n2 ? 3 : 1] ^ e2[1], m2 = t2[2] ^ e2[2], S2 = t2[n2 ? 1 : 3] ^ e2[3], g2 = 4;
      for (let t3 = 0; t3 < s2; t3++) w2 = i2[d2 >>> 24] ^ a2[y2 >> 16 & 255] ^ f2[m2 >> 8 & 255] ^ u2[255 & S2] ^ e2[g2], h2 = i2[y2 >>> 24] ^ a2[m2 >> 16 & 255] ^ f2[S2 >> 8 & 255] ^ u2[255 & d2] ^ e2[g2 + 1], p2 = i2[m2 >>> 24] ^ a2[S2 >> 16 & 255] ^ f2[d2 >> 8 & 255] ^ u2[255 & y2] ^ e2[g2 + 2], S2 = i2[S2 >>> 24] ^ a2[d2 >> 16 & 255] ^ f2[y2 >> 8 & 255] ^ u2[255 & m2] ^ e2[g2 + 3], g2 += 4, d2 = w2, y2 = h2, m2 = p2;
      for (let t3 = 0; t3 < 4; t3++) o2[n2 ? 3 & -t3 : t3] = l2[d2 >>> 24] << 24 ^ l2[y2 >> 16 & 255] << 16 ^ l2[m2 >> 8 & 255] << 8 ^ l2[255 & S2] ^ e2[g2++], w2 = d2, d2 = y2, y2 = m2, m2 = S2, S2 = w2;
      return o2;
    }
  }, it = class {
    constructor(t2, n2) {
      this.G = t2, this.J = n2, this.X = n2;
    }
    reset() {
      this.X = this.J;
    }
    update(t2) {
      return this.Y(this.G, t2, this.X);
    }
    Z(t2) {
      if (255 & ~(t2 >> 24)) t2 += 1 << 24;
      else {
        let n2 = t2 >> 16 & 255, e2 = t2 >> 8 & 255, s2 = 255 & t2;
        255 === n2 ? (n2 = 0, 255 === e2 ? (e2 = 0, 255 === s2 ? s2 = 0 : ++s2) : ++e2) : ++n2, t2 = 0, t2 += n2 << 16, t2 += e2 << 8, t2 += s2;
      }
      return t2;
    }
    $(t2) {
      0 === (t2[0] = this.Z(t2[0])) && (t2[1] = this.Z(t2[1]));
    }
    Y(t2, n2, e2) {
      let s2;
      if (!(s2 = n2.length)) return [];
      const r2 = T.bitLength(n2);
      for (let r3 = 0; r3 < s2; r3 += 4) {
        this.$(e2);
        const s3 = t2.encrypt(e2);
        n2[r3] ^= s3[0], n2[r3 + 1] ^= s3[1], n2[r3 + 2] ^= s3[2], n2[r3 + 3] ^= s3[3];
      }
      return T.m(n2, r2);
    }
  }, at = E._;
  let ft = et && rt && typeof st.importKey == k, ut = et && rt && typeof st.deriveBits == k;
  class lt extends d {
    constructor({ password: t2, rawPassword: n2, encryptionStrength: e2, checkPasswordOnly: s2, checkAuthenticationCode: c2 = true }) {
      super({ start() {
        ht(this, t2, n2, e2);
      }, async transform(t3, n3) {
        const e3 = this, { password: c3, strength: i2, nt: a2, ready: f2 } = e3;
        c3 ? (await (async function(t4, n4, e4, s3) {
          const o2 = await dt(t4, n4, e4, mt(s3, 0, Z[n4])), c4 = mt(s3, Z[n4]);
          if (o2[0] != c4[0] || o2[1] != c4[1]) throw new r(O);
        })(e3, i2, c3, mt(t3, 0, Z[i2] + 2)), t3 = mt(t3, Z[i2] + 2), s2 ? n3.error(new r(N)) : a2()) : await f2;
        const u2 = new o(t3.length - tt - (t3.length - tt) % G);
        n3.enqueue(pt(e3, t3, u2, 0, tt, true));
      }, async flush(t3) {
        const { et: n3, st: e3, ot: s3, ready: o2 } = this;
        if (e3 && n3) {
          await o2;
          const i2 = mt(s3, 0, s3.length - tt), a2 = mt(s3, s3.length - tt);
          let f2 = z;
          if (i2.length) {
            const t4 = gt(ot, i2);
            e3.update(t4);
            const s4 = n3.update(t4);
            f2 = St(ot, s4);
          }
          const u2 = mt(St(ot, e3.digest()), 0, tt);
          let l2 = s3.length < tt ? 1 : 0;
          for (let t4 = 0; t4 < tt; t4++) l2 |= u2[t4] ^ a2[t4];
          if (l2 && c2) throw new r(H);
          t3.enqueue(f2);
        }
      } });
    }
  }
  class wt extends d {
    constructor({ password: t2, rawPassword: n2, encryptionStrength: e2 }) {
      super({ start() {
        ht(this, t2, n2, e2);
      }, async transform(t3, n3) {
        const e3 = this, { password: s2, strength: r2, nt: c2, ready: i2 } = e3;
        let a2 = z;
        s2 ? (a2 = await (async function(t4, n4, e4) {
          const s3 = q(new o(Z[n4]));
          return W(s3, await dt(t4, n4, e4, s3));
        })(e3, r2, s2), c2()) : await i2;
        const f2 = new o(a2.length + t3.length - t3.length % G);
        f2.set(a2, 0), n3.enqueue(pt(e3, t3, f2, a2.length, 0));
      }, async flush(t3) {
        const { et: n3, st: e3, ot: s2, ready: r2 } = this;
        if (e3 && n3) {
          await r2;
          let o2 = z;
          if (s2.length) {
            const t4 = n3.update(gt(ot, s2));
            e3.update(t4), o2 = St(ot, t4);
          }
          const c2 = St(ot, e3.digest()).slice(0, tt);
          t3.enqueue(W(o2, c2));
        }
      } });
    }
  }
  function ht(t2, e2, s2, r2) {
    n.assign(t2, { ready: new l((n2) => t2.nt = n2), password: yt(e2, s2), strength: r2 - 1, ot: z });
  }
  function pt(t2, n2, e2, s2, r2, c2) {
    const { et: i2, st: a2, ot: f2 } = t2;
    f2.length && (n2 = W(f2, n2));
    const u2 = n2.length - r2;
    let l2;
    for (e2 = (function(t3, n3) {
      if (n3 && n3 > t3.length) {
        const e3 = t3;
        (t3 = new o(n3)).set(e3, 0);
      }
      return t3;
    })(e2, s2 + (u2 - u2 % G)), l2 = 0; l2 <= u2 - G; l2 += G) {
      const t3 = gt(ot, mt(n2, l2, l2 + G));
      c2 && a2.update(t3);
      const r3 = i2.update(t3);
      c2 || a2.update(r3), e2.set(St(ot, r3), l2 + s2);
    }
    return t2.ot = mt(n2, l2), e2;
  }
  async function dt(e2, s2, r2, c2) {
    e2.password = null;
    const i2 = await (async function(t2, n2, e3, s3, r3) {
      if (!ft) return E.importKey(n2);
      try {
        return await st.importKey("raw", n2, e3, false, r3);
      } catch {
        return ft = false, E.importKey(n2);
      }
    })(0, r2, Q, 0, Y), a2 = await (async function(t2, n2, e3) {
      if (!ut) return E.T(n2, t2.salt, X.iterations, e3);
      try {
        return await st.deriveBits(t2, n2, e3);
      } catch {
        return ut = false, E.T(n2, t2.salt, X.iterations, e3);
      }
    })(n.assign({ salt: c2 }, X), i2, 8 * (2 * $[s2] + 2)), f2 = new o(a2), u2 = gt(ot, mt(f2, 0, $[s2])), l2 = gt(ot, mt(f2, $[s2], 2 * $[s2])), w2 = mt(f2, 2 * $[s2]);
    return n.assign(e2, { keys: { key: u2, ct: l2, passwordVerification: w2 }, et: new it(new ct(u2), t.from(nt)), st: new at(l2) }), w2;
  }
  function yt(t2, n2) {
    return n2 === v ? (function(t3) {
      if (typeof w == b) {
        t3 = unescape(encodeURIComponent(t3));
        const n3 = new o(t3.length);
        for (let e2 = 0; e2 < n3.length; e2++) n3[e2] = t3.charCodeAt(e2);
        return n3;
      }
      return new w().encode(t3);
    })(t2) : n2;
  }
  function mt(t2, n2, e2) {
    return t2.subarray(n2, e2);
  }
  function St(t2, n2) {
    return t2.v(n2);
  }
  function gt(t2, n2) {
    return t2.C(n2);
  }
  class vt extends d {
    constructor({ password: t2, rawPassword: n2, passwordVerification: e2, checkPasswordOnly: s2 }) {
      super({ start() {
        kt(this, t2, n2, e2);
      }, transform(t3, n3) {
        const e3 = this;
        if (e3.password || e3.rawPassword) {
          const n4 = zt(e3, t3.subarray(0, 12));
          if (e3.password = e3.rawPassword = null, 0 != (n4[11] ^ e3.passwordVerification)) throw new r(O);
          t3 = t3.subarray(12);
        }
        s2 ? n3.error(new r(N)) : n3.enqueue(zt(e3, t3));
      } });
    }
  }
  class bt extends d {
    constructor({ password: t2, rawPassword: n2, passwordVerification: e2 }) {
      super({ start() {
        kt(this, t2, n2, e2);
      }, transform(t3, n3) {
        const e3 = this;
        let s2, r2;
        if (e3.password || e3.rawPassword) {
          e3.password = e3.rawPassword = null;
          const n4 = q(new o(12));
          n4[11] = e3.passwordVerification, s2 = new o(t3.length + n4.length), s2.set(Ct(e3, n4), 0), r2 = 12;
        } else s2 = new o(t3.length), r2 = 0;
        s2.set(Ct(e3, t3), r2), n3.enqueue(s2);
      } });
    }
  }
  function kt(t2, e2, s2, r2) {
    n.assign(t2, { password: e2, rawPassword: s2, passwordVerification: r2 }), (function(t3, e3, s3) {
      const r3 = [305419896, 591751049, 878082192];
      if (n.assign(t3, { keys: r3, it: new R(r3[0]), ft: new R(r3[2]) }), s3) for (let n2 = 0; n2 < s3.length; n2++) It(t3, s3[n2]);
      else for (let n2 = 0; n2 < e3.length; n2++) It(t3, e3.charCodeAt(n2));
    })(t2, e2, s2);
  }
  function zt(t2, n2) {
    const e2 = new o(n2.length);
    for (let s2 = 0; s2 < n2.length; s2++) e2[s2] = At(t2) ^ n2[s2], It(t2, e2[s2]);
    return e2;
  }
  function Ct(t2, n2) {
    const e2 = new o(n2.length);
    for (let s2 = 0; s2 < n2.length; s2++) e2[s2] = At(t2) ^ n2[s2], It(t2, n2[s2]);
    return e2;
  }
  function It(t2, n2) {
    let [, e2] = t2.keys;
    t2.it.append([n2]);
    const r2 = ~t2.it.get();
    e2 = Mt(s.imul(Mt(e2 + xt(r2)), 134775813) + 1), t2.ft.append([e2 >>> 24]);
    const o2 = ~t2.ft.get();
    t2.keys = [r2, e2, o2];
  }
  function At(t2) {
    const n2 = 2 | t2.keys[2];
    return xt(s.imul(n2, 1 ^ n2) >>> 8);
  }
  function xt(t2) {
    return 255 & t2;
  }
  function Mt(t2) {
    return 4294967295 & t2;
  }
  function Pt(t2) {
    if (t2 instanceof y) return t2;
    const n2 = t2.getReader();
    return new y({ async pull(t3) {
      const { value: e2, done: s2 } = await n2.read();
      s2 ? t3.close() : t3.enqueue(e2);
    }, cancel: (t3) => n2.cancel(t3) });
  }
  const Bt = new f();
  function Dt(t2) {
    return Bt.get(t2);
  }
  const Ft = "Invalid uncompressed size", Rt = j, Ut = "deflate-raw", Wt = "gzip", _t = [31, 139, 8];
  class Tt extends d {
    constructor(t2, { chunkSize: n2, CompressionStreamFallback: e2, CompressionStream: s2 }) {
      super({});
      const { compressed: r2, encrypted: o2, useCompressionStream: c2, zipCrypto: i2, computeCrc32: a2, level: f2, deflate64: l2, format: w2, compressionMethod: h2, inputSize: p2 } = t2, d2 = this;
      let y2, m2, S2, g2 = super.readable;
      const v2 = w2 && Dt(w2), b2 = a2 && r2 && !l2 && !v2 && (!o2 || i2) && Boolean(c2 && s2);
      if (o2 && !i2 || !a2 || b2 || (y2 = new U(), g2 = Ht(g2, y2)), r2) if (v2) g2 = Nt(g2, Ot(v2.CompressionStream, w2, { level: f2, chunkSize: n2, compressionMethod: h2, uncompressedSize: p2 }));
      else if (b2) S2 = new Vt(), g2 = Nt(g2, new s2(Wt)), g2 = Ht(g2, S2);
      else try {
        g2 = jt(g2, c2, { level: f2, chunkSize: n2 }, s2, e2);
      } catch (t3) {
        let n3;
        try {
          n3 = new s2(Wt);
        } catch {
          throw t3;
        }
        g2 = Nt(g2, n3), g2 = Ht(g2, new Vt());
      }
      o2 && (i2 ? g2 = Ht(g2, new bt(t2)) : (m2 = new wt(t2), g2 = Ht(g2, m2))), Lt(d2, g2, () => {
        o2 && !i2 || !a2 || (d2.crc32 = b2 ? S2.crc32 : new u(y2.value.buffer).getUint32(0));
      });
    }
  }
  class Vt extends d {
    constructor() {
      let t2, n2 = 10, e2 = new o(0);
      super({ transform(t3, r2) {
        if (n2) {
          const e3 = s.min(n2, t3.length);
          if (n2 -= e3, !(t3 = t3.subarray(e3)).length) return;
        }
        const o2 = e2.length + t3.length;
        if (o2 <= 8) return void (e2 = W(e2, t3));
        const c2 = o2 - 8, i2 = s.min(c2, e2.length);
        r2.enqueue(W(e2.subarray(0, i2), t3.subarray(0, c2 - i2))), e2 = W(e2.subarray(i2), t3.subarray(c2 - i2));
      }, flush() {
        const n3 = _(e2);
        t2.crc32 = n3.getUint32(0, true), t2.uncompressedSize = n3.getUint32(4, true);
      } }), t2 = this;
    }
  }
  class Kt extends d {
    constructor(t2, { chunkSize: n2, DecompressionStreamFallback: e2, DecompressionStream: s2 }) {
      super({});
      const { zipCrypto: c2, encrypted: i2, checkCrc32: a2, crc32: f2, compressed: w2, useCompressionStream: h2, deflate64: p2, format: m2, compressionMethod: S2, rawBitFlag: g2, outputSize: b2 } = t2;
      let k2, z2, C2 = super.readable;
      if (i2 && (c2 ? C2 = Ht(C2, new vt(t2)) : (z2 = new lt(t2), C2 = Ht(C2, z2))), w2) {
        const t3 = m2 && Dt(m2);
        if (t3) C2 = Nt(C2, Ot(t3.DecompressionStream, m2, { chunkSize: n2, compressionMethod: S2, rawBitFlag: g2, uncompressedSize: b2 }));
        else try {
          C2 = jt(C2, h2, { chunkSize: n2, deflate64: p2 }, s2, e2);
        } catch (t4) {
          if (p2 || b2 === v) throw t4;
          let n3;
          try {
            n3 = new s2(Wt);
          } catch {
            throw t4;
          }
          C2 = (function(t5, n4, e3) {
            const s3 = new R();
            let c3, i3, a3, f3 = 0, u2 = false;
            const w3 = new l((t6, n5) => {
              i3 = t6, a3 = n5;
            });
            w3.catch(() => {
            }), e3 || i3();
            const h3 = new d({ start(t6) {
              const n5 = new o(10);
              n5.set(_t), t6.enqueue(n5);
            }, transform(t6, n5) {
              n5.enqueue(t6);
            }, async flush(t6) {
              u2 = true, y2();
              try {
                await w3;
              } finally {
                m3();
              }
              const n5 = new o(8), r2 = _(n5);
              r2.setUint32(0, s3.get(), true), r2.setUint32(4, e3, true), t6.enqueue(n5);
            }, cancel(t6) {
              a3(t6);
            } }), p3 = new d({ transform(t6, n5) {
              s3.append(t6), f3 += t6.length, f3 >= e3 ? i3() : u2 && y2(), n5.enqueue(t6);
            }, cancel(t6) {
              a3(t6);
            } });
            return t5 = Ht(t5, h3), Ht(t5 = Nt(t5, n4), p3);
            function y2() {
              m3(), c3 = setTimeout(() => a3(new r(Ft)), 5e3);
            }
            function m3() {
              clearTimeout(c3);
            }
          })(C2, n3, b2);
        }
        C2 = (function(t4) {
          const n3 = t4.getReader();
          return new y({ async pull(t5) {
            let e3;
            try {
              e3 = await n3.read();
            } catch (t6) {
              if (t6 && t6.message) throw t6;
              const n4 = new r("Invalid compressed data");
              throw n4.cause = t6, n4;
            }
            const { value: s3, done: o2 } = e3;
            o2 ? t5.close() : t5.enqueue(s3);
          }, cancel: (t5) => n3.cancel(t5) });
        })(C2);
      }
      a2 && (k2 = new U(), C2 = Ht(C2, k2)), Lt(this, C2, () => {
        if (a2) {
          const t3 = new u(k2.value.buffer);
          if (f2 != t3.getUint32(0, false)) throw new r(Rt);
        }
      });
    }
  }
  const Et = new f();
  function Lt(t2, e2, s2) {
    e2 = Ht(e2, new d({ flush: s2 })), n.defineProperty(t2, "readable", { get: () => e2 });
  }
  function Ot(t2, n2, e2) {
    if (!t2) throw new r("Compression method not supported");
    return new t2(n2, e2);
  }
  function jt(t2, n2, e2, s2, r2) {
    const o2 = n2 && s2 ? s2 : r2 || s2, c2 = e2.deflate64 ? "deflate64-raw" : Ut;
    let i2;
    try {
      i2 = new o2(c2, e2);
    } catch (t3) {
      if (!n2 || !r2 || o2 == r2) throw t3;
      i2 = new r2(c2, e2);
    }
    return Nt(t2, i2);
  }
  function Ht(t2, n2) {
    return Pt(t2).pipeThrough(n2);
  }
  function Nt(t2, n2) {
    const e2 = n2.writable.getWriter(), s2 = t2.getReader();
    return (async function() {
      try {
        for (; ; ) {
          await e2.ready;
          const t3 = await s2.read();
          if (t3.done) {
            await e2.close();
            break;
          }
          await e2.write(t3.value);
        }
      } catch (t3) {
        await (async function(t4, n3) {
          try {
            await t4.abort(n3);
          } catch {
          }
        })(e2, t3), await (async function(t4, n3) {
          try {
            await t4.cancel(n3);
          } catch {
          }
        })(s2, t3);
      }
    })(), n2.readable;
  }
  const qt = "data", Gt = "close", Jt = "deflate";
  class Qt extends d {
    constructor(t2, e2) {
      super({});
      const s2 = this, { codecType: o2 } = t2;
      let c2;
      o2.startsWith(Jt) ? c2 = Tt : o2.startsWith("inflate") && (c2 = Kt), s2.outputSize = 0;
      let i2 = 0;
      const a2 = new c2(t2, e2), f2 = super.readable, u2 = new d({ transform(t3, n2) {
        t3 && t3.length && (i2 += t3.length, n2.enqueue(t3));
      }, flush() {
        n.assign(s2, { inputSize: i2 });
      } }), l2 = new d({ transform(n2, e3) {
        if (n2 && n2.length && (e3.enqueue(n2), s2.outputSize += n2.length, t2.outputSize !== v && s2.outputSize > t2.outputSize)) throw new r(Ft);
      }, flush() {
        const { crc32: t3 } = a2;
        n.assign(s2, { crc32: t3, inputSize: i2 });
      } });
      n.defineProperty(s2, "readable", { get: () => f2.pipeThrough(u2).pipeThrough(a2).pipeThrough(l2) });
    }
  }
  class Xt extends d {
    constructor(t2) {
      const n2 = [];
      let s2 = 0;
      function r2() {
        const e2 = new o(t2);
        let r3 = 0;
        for (; r3 < t2; ) {
          const s3 = n2[0], o2 = t2 - r3;
          s3.length <= o2 ? (e2.set(s3, r3), r3 += s3.length, n2.shift()) : (e2.set(s3.subarray(0, o2), r3), n2[0] = s3.subarray(o2), r3 += o2);
        }
        return s2 -= t2, e2;
      }
      (!e.isFinite(t2) || t2 < 1) && (t2 = 65536), super({ transform(e2, o2) {
        for (n2.push(e2), s2 += e2.length; s2 > t2; ) o2.enqueue(r2());
      }, flush(t3) {
        s2 && t3.enqueue((function(t4, n3) {
          const e2 = new o(n3);
          let s3 = 0;
          for (const n4 of t4) e2.set(n4, s3), s3 += n4.length;
          return e2;
        })(n2, s2));
      } });
    }
  }
  let Yt = 2;
  try {
    typeof navigator != b && navigator.hardwareConcurrency && (Yt = navigator.hardwareConcurrency);
  } catch {
  }
  const Zt = new f(), $t = new f();
  let tn, nn = 0;
  async function en(t2) {
    let n2, o2;
    try {
      const { options: c2, config: i2 } = t2;
      if (c2.format) try {
        await (async function(t3, n3) {
          !Bt.has(t3) && n3 && (function(t4, n4) {
            const { CompressionStream: e2, DecompressionStream: s2 } = n4;
            if (typeof e2 != k && typeof s2 != k) throw new r("Invalid codec module");
            Bt.set(t4, { CompressionStream: e2, DecompressionStream: s2 });
          })(t3, await import(
            /* webpackIgnore: true */
            /* @vite-ignore */
            n3
          ));
        })(c2.format, c2.codecURI);
      } catch (t3) {
        throw t3.codecImportFailed = true, t3;
      }
      if (i2.CompressionStream = self.CompressionStream, i2.DecompressionStream = self.DecompressionStream, c2.compressed && !c2.format) if (c2.useCompressionStream) {
        if (!(function(t3, n3) {
          if (!t3) return false;
          let e2 = Et.get(t3);
          e2 || (e2 = new f(), Et.set(t3, e2));
          let s2 = e2.get(n3);
          if (s2 === v) {
            try {
              new t3(n3), s2 = true;
            } catch {
              s2 = false;
            }
            e2.set(n3, s2);
          }
          return s2;
        })(c2.codecType.startsWith(Jt) ? i2.CompressionStream : i2.DecompressionStream, Ut)) try {
          await self.initModule(t2.config);
        } catch {
        }
      } else try {
        await self.initModule(t2.config);
      } catch {
        c2.useCompressionStream = true;
      }
      !i2.CompressionStreamFallback && i2.CompressionStreamZlib && (i2.CompressionStreamFallback = i2.CompressionStreamZlib), !i2.DecompressionStreamFallback && i2.DecompressionStreamZlib && (i2.DecompressionStreamFallback = i2.DecompressionStreamZlib);
      const a2 = { highWaterMark: 1 }, u2 = t2.readable ? Pt(t2.readable) : new y({ async pull(t3) {
        const n3 = new l((t4) => Zt.set(nn, t4));
        sn({ type: "pull", messageId: nn }), nn = (nn + 1) % e.MAX_SAFE_INTEGER;
        const { value: s2, done: r2 } = await n3;
        t3.enqueue(s2), r2 && t3.close();
      } }, a2);
      o2 = t2.writable ? (function(t3) {
        if (t3 instanceof m) return t3;
        const n3 = t3.getWriter();
        return new m({ write: (t4) => n3.write(t4), close: () => n3.close(), abort: (t4) => n3.abort(t4) });
      })(t2.writable) : new m({ async write(t3) {
        let n3;
        const s2 = new l((t4) => n3 = t4);
        $t.set(nn, n3), sn({ type: qt, value: t3, messageId: nn }), nn = (nn + 1) % e.MAX_SAFE_INTEGER, await s2;
      } }, a2), n2 = new Qt(c2, i2), tn = new AbortController();
      const { signal: w2 } = tn;
      await u2.pipeThrough(n2).pipeThrough(new Xt((function(t3) {
        return r2 = "string" == typeof (n3 = r2 = t3.chunkSize) && n3.trim() ? e(n3) : n3, e.isInteger(r2) && r2 >= 1 ? s.max(r2, 64) : 65536;
        var n3, r2;
      })(i2))).pipeTo(o2, { signal: w2, preventClose: true, preventAbort: true }), await o2.getWriter().close();
      const { crc32: h2, inputSize: p2, outputSize: d2 } = n2;
      sn({ type: Gt, result: { crc32: h2, inputSize: p2, outputSize: d2 } });
    } catch (t3) {
      if (t3.outputSize = n2 ? n2.outputSize : 0, o2 && !o2.locked) try {
        await o2.getWriter().close();
      } catch {
      }
      rn(t3);
    }
  }
  function sn(t2) {
    const { value: n2 } = t2;
    if (n2) if (n2.length) try {
      t2.value = (e2 = n2, e2.byteOffset || e2.byteLength != e2.buffer.byteLength ? new o(e2) : e2).buffer, p(t2, [t2.value]);
    } catch {
      p(t2);
    }
    else p(t2);
    else p(t2);
    var e2;
  }
  function rn(t2 = new r("Unknown error")) {
    const { message: n2, stack: e2, code: s2, name: o2, outputSize: c2, cause: i2, codecImportFailed: a2 } = t2, f2 = { message: n2, stack: e2, code: s2, name: o2, outputSize: c2 };
    i2 && (f2.cause = { name: i2.name, message: i2.message }), a2 && (f2.codecImportFailed = true), p({ error: f2 });
  }
  addEventListener("message", ({ data: t2 }) => {
    const { type: n2, messageId: e2, value: s2, done: r2 } = t2;
    try {
      if ("start" == n2 && en(t2), n2 == qt) {
        const t3 = Zt.get(e2);
        Zt.delete(e2), t3({ value: s2 || new o(), done: r2 });
      }
      if ("ack" == n2) {
        const t3 = $t.get(e2);
        $t.delete(e2), t3();
      }
      n2 == Gt && tn.abort();
    } catch (t3) {
      rn(t3);
    }
  }), p({ type: "ready" });
  const on = "deflate", cn = "deflate-raw", an = "deflate64-raw", fn = "gzip";
  let un, ln, wn, hn, pn;
  function dn(t2, n2, e2 = {}) {
    if (!un) {
      const t3 = new r("WASM module not loaded");
      throw t3.cause = pn, t3;
    }
    const c2 = "number" == typeof e2.level ? e2.level : -1, i2 = "number" == typeof e2.outBuffer ? e2.outBuffer : 65536, a2 = "number" == typeof e2.inBufferSize ? e2.inBufferSize : 65536;
    return new d({ start() {
      try {
        let e3;
        if (this.ut = ln(i2), this.in = ln(a2), this.inBufferSize = a2, !this.ut || !this.in) throw new r("allocation failed");
        if (this.lt = new o(i2), t2 ? (this.wt = un.deflate_process, this.ht = un.deflate_last_consumed, this.yt = un.deflate_end, this.St = un.deflate_new(), e3 = n2 === fn ? un.deflate_init_gzip(this.St, c2) : n2 === cn ? un.deflate_init_raw(this.St, c2) : un.deflate_init(this.St, c2)) : n2 === an ? (this.wt = un.inflate9_process, this.ht = un.inflate9_last_consumed, this.yt = un.inflate9_end, this.St = un.inflate9_new(), e3 = un.inflate9_init_raw(this.St)) : (this.wt = un.inflate_process, this.ht = un.inflate_last_consumed, this.yt = un.inflate_end, this.St = un.inflate_new(), e3 = n2 === cn ? un.inflate_init_raw(this.St) : n2 === fn ? un.inflate_init_gzip(this.St) : un.inflate_init(this.St)), 0 !== e3) throw new r("init failed:" + e3);
      } catch (t3) {
        throw f2(this), t3;
      }
    }, transform(n3, e3) {
      try {
        const c3 = n3, a3 = new o(hn.buffer), f3 = this.wt, u2 = this.ht, l2 = this.ut, w2 = this.lt;
        let h2 = 0;
        for (; h2 < c3.length; ) {
          const n4 = s.min(c3.length - h2, 32768);
          if ((!this.in || this.inBufferSize < n4) && (this.in && wn && (wn(this.in), this.in = 0), this.in = ln(n4), this.inBufferSize = n4, !this.in)) throw new r("allocation failed");
          a3.set(c3.subarray(h2, h2 + n4), this.in);
          const o2 = f3(this.St, this.in, n4, l2, i2, 0), p2 = 16777215 & o2;
          if (p2 && (w2.set(a3.subarray(l2, l2 + p2), 0), e3.enqueue(w2.slice(0, p2))), !t2) {
            const t3 = o2 >> 24 & 255, n5 = 128 & t3 ? t3 - 256 : t3;
            if (n5 < 0) throw new r("process error:" + n5);
          }
          const d2 = u2(this.St);
          if (0 === d2) break;
          h2 += d2;
        }
      } catch (t3) {
        f2(this), e3.error(t3);
      }
    }, flush(n3) {
      try {
        const e3 = new o(hn.buffer), s2 = this.wt, c3 = this.ut, a3 = this.lt;
        for (; ; ) {
          const o2 = s2(this.St, 0, 0, c3, i2, 4), f3 = 16777215 & o2, u2 = o2 >> 24 & 255;
          if (!t2) {
            const t3 = 128 & u2 ? u2 - 256 : u2;
            if (t3 < 0) throw new r("process error:" + t3);
          }
          if (f3 && (a3.set(e3.subarray(c3, c3 + f3), 0), n3.enqueue(a3.slice(0, f3))), 1 === u2 || 0 === f3) break;
        }
      } catch (t3) {
        n3.error(t3);
      } finally {
        const t3 = f2(this);
        0 !== t3 && n3.error(new r("end error:" + t3));
      }
    }, cancel() {
      f2(this);
    } });
    function f2(t3) {
      let n3 = 0;
      return t3.St && t3.yt && (n3 = t3.yt(t3.St)), t3.St = 0, t3.in && wn && wn(t3.in), t3.in = 0, t3.ut && wn && wn(t3.ut), t3.ut = 0, n3;
    }
  }
  class yn {
    constructor(t2 = on, n2) {
      return dn(true, t2, n2);
    }
  }
  class mn {
    constructor(t2 = on, n2) {
      return dn(false, t2, n2);
    }
  }
  yn.gt = true, mn.gt = true, yn.vt = [on, cn, fn], mn.vt = [on, cn, fn, an];
  let Sn = false;
  !(function(t2 = {}) {
    const { init: n2 } = t2, e2 = t2.CompressionStreamFallback || t2.CompressionStreamZlib, s2 = t2.DecompressionStreamFallback || t2.DecompressionStreamZlib;
    self.initModule = async (t3) => {
      n2 && await n2(t3), e2 && (t3.CompressionStreamFallback = e2), s2 && (t3.DecompressionStreamFallback = s2);
    };
  })({ CompressionStreamFallback: yn, DecompressionStreamFallback: mn, init: (t2) => (async function(t3, { baseURI: n2 }) {
    if (!Sn) try {
      await (async function(t4, n3) {
        let e2, s2;
        try {
          try {
            s2 = new URL(t4, n3);
          } catch {
          }
          const r2 = await fetch(s2);
          e2 = await r2.arrayBuffer();
        } catch (n4) {
          if (!t4.startsWith("data:application/wasm;base64,")) throw n4;
          e2 = (function(t5) {
            const n5 = t5.split(",")[1], e3 = atob(n5), s3 = e3.length, r2 = new o(s3);
            for (let t6 = 0; t6 < s3; ++t6) r2[t6] = e3.charCodeAt(t6);
            return r2.buffer;
          })(t4);
        }
        !(function(t5) {
          if (un = t5, { malloc: ln, free: wn, memory: hn } = un, "function" != typeof ln || "function" != typeof wn || !hn) throw un = ln = wn = hn = null, new r("Invalid WASM module");
        })((await WebAssembly.instantiate(e2)).instance.exports);
      })(t3, n2), Sn = true;
    } catch (t4) {
      throw (function(t5) {
        pn = t5;
      })(t4), t4;
    }
  })(t2.wasmURI, t2) });
})();
