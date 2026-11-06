/* Ramack Film: o vidro, o rodo e o carro */
(function () {
  var doc = document.documentElement;
  var calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function trava(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- Menu e cabecalho ---------- */
  var nav = document.querySelector(".nav");
  var menu = document.querySelector(".nav__menu");
  if (menu) menu.addEventListener("click", function () {
    var aberto = nav.classList.toggle("aberto");
    menu.setAttribute("aria-expanded", aberto);
    menu.textContent = aberto ? "Fechar" : "Menu";
  });
  addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav && nav.classList.contains("aberto")) { menu.click(); menu.focus(); }
  });

  /* ---------- Aberta ou fechada, no horario de Sao Paulo ---------- */
  var HORARIO = { 1: [540, 1050], 2: [540, 1050], 3: [540, 1050], 4: [540, 1050], 5: [540, 1050], 6: [510, 780] };
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  function hora(m) { var h = Math.floor(m / 60), r = m % 60; return h + "h" + (r ? (r < 10 ? "0" : "") + r : ""); }
  function agoraSP() {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: +p.hour * 60 + +p.minute };
  }
  function atualizaStatus() {
    var a = agoraSP(), h = HORARIO[a.dia], aberta = h && a.min >= h[0] && a.min < h[1], texto;
    if (aberta) texto = "Aberta agora, fecha às " + hora(h[1]);
    else if (h && a.min < h[0]) texto = "Fechada agora, abre hoje às " + hora(h[0]);
    else {
      var d = (a.dia + 1) % 7;
      while (!HORARIO[d]) d = (d + 1) % 7;
      texto = "Fechada agora, abre " + (d === (a.dia + 1) % 7 ? "amanhã" : DIAS[d]) + " às " + hora(HORARIO[d][0]);
    }
    document.querySelectorAll("[data-status]").forEach(function (el) { el.textContent = texto; el.classList.toggle("aberta", !!aberta); });
    document.querySelectorAll(".horas tr[data-dias]").forEach(function (tr) { tr.classList.toggle("hoje", tr.dataset.dias.split(",").indexOf(String(a.dia)) >= 0); });
  }
  atualizaStatus();
  setInterval(atualizaStatus, 60000);

  /* ---------- Vidro em WebGL ---------- */
  var VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FS = [
    "precision highp float;",
    "uniform vec2 R;uniform float T,E,N;uniform vec2 S;",
    "float h1(float n){return fract(sin(n*91.17)*43758.5453);}",
    "float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}",
    // Predios fora de foco: alturas suaves, janelas apenas sugeridas
    "float predio(vec2 p,float esc,float sem,float base,float amp){float x=p.x*esc+sem;float i=floor(x);float f=fract(x);float a=mix(h1(i+sem),h1(i+1.+sem),smoothstep(.40,.60,f));return base-amp*a;}",
    "vec3 rua(vec2 uv,float asp){",
    " vec2 p=vec2(uv.x*asp,uv.y);",
    " vec3 c=mix(vec3(.50,.66,.82),vec3(.97,.86,.66),smoothstep(.05,.72,uv.y));",
    " float t1=predio(p,1.6,3.,.70,.42);c=mix(c,vec3(.62,.67,.72),smoothstep(-.012,.012,uv.y-t1));",
    " float t2=predio(p,2.7,11.,.82,.44);float m2=smoothstep(-.012,.012,uv.y-t2);",
    " float jan=smoothstep(.1,.5,sin(p.y*88.))*smoothstep(.0,.5,sin(p.x*64.));",
    " c=mix(c,mix(vec3(.31,.34,.38),vec3(.62,.60,.50),jan*.55),m2);",
    " float t3=predio(p,4.3,23.,.93,.32);float m3=smoothstep(-.016,.016,uv.y-t3);",
    " float jan3=smoothstep(.0,.55,sin(p.y*58.+1.))*smoothstep(.0,.55,sin(p.x*44.));",
    " c=mix(c,mix(vec3(.13,.15,.17),vec3(.55,.48,.30),jan3*.6),m3);",
    " float n=vn(vec2(p.x*7.+T*.02,uv.y*5.))*.5+vn(vec2(p.x*17.,uv.y*13.-T*.03))*.25;",
    " float copa=smoothstep(.60,.78,uv.y+n*.36);c=mix(c,mix(vec3(.08,.20,.11),vec3(.28,.40,.14),n),copa);",
    " for(int i=0;i<9;i++){float f=float(i);vec2 q=vec2(h1(f+2.)*asp,.56+h1(f+7.)*.38);float d=length(p-q);c+=vec3(.75,.58,.30)*(.5+.5*h1(f))*.3*smoothstep(.052,.034,d);}",
    " return c;}",
    "void main(){",
    " vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;float asp=R.x/R.y;vec2 px=vec2(uv.x*R.x,uv.y*R.y);",
    " vec3 r=rua(uv,asp);float l=dot(r,vec3(.3,.59,.11));",
    " vec2 ds=(uv-S)*vec2(asp,1.);float d=length(ds);",
    // Vidro sem pelicula: amarelo do logo estourado de sol, a rua vira fantasma
    " vec3 ouro=vec3(.988,.812,.031);",
    " vec3 sol=ouro*(.875+.125*smoothstep(.1,.75,l));",
    " sol=mix(sol,vec3(1.,.965,.74),clamp(.62/(1.+d*d*11.)+.10*vn(uv*vec2(asp*3.,3.)+T*.02),0.,1.));",
    // Vidro com pelicula: a rua aparece, o sol vira um disco contido
    " float esc=mix(.92,.24,N)*mix(.72,.82,smoothstep(.0,.62,uv.y));",
    " vec3 fil=r*vec3(.90,.93,.94)*esc;",
    " fil=mix(fil,vec3(dot(fil,vec3(.33))),.42);",
    " float ang=atan(ds.y,ds.x);float raio=pow(.5+.5*sin(ang*7.+.6),6.)*.5+pow(.5+.5*sin(ang*13.+2.),10.)*.35;fil+=vec3(.95,.72,.16)*(raio*exp(-d*5.2)*mix(.9,.5,N)+.5*exp(-d*7.)*mix(.9,.55,N));fil=mix(fil,vec3(1.,.90,.52),smoothstep(.046,.036,d)*mix(1.,.72,N));",
    " float brilho=smoothstep(.9,1.,sin((uv.x*asp+uv.y*.55)*5.2+.7))*.03;fil+=brilho;",
    " float tom=smoothstep(0.,.24,N);",
    " fil=mix(sol,fil,tom);",
    // A borda da pelicula: agua, bolhas, linha de luz e sombra
    " float s=uv.y-E;float pxy=1./R.y;",
    " vec3 c;",
    " if(s<0.){",
    "  c=fil;float w=exp(s*26.);",
    "  float st=vn(vec2(uv.x*asp*26.,uv.y*5.+T*.05));",
    "  c+=vec3(.55,.46,.16)*w*w*smoothstep(.45,.95,st)*.75;",
    "  vec2 g=vec2(uv.x*asp,uv.y)*38.;vec2 gi=floor(g);vec2 gf=fract(g)-.5;float hb=h2(gi);",
    "  float rb=.10+.26*h2(gi+3.);float bo=smoothstep(rb,rb-.05,length(gf+(vec2(hb,h2(gi+9.))-.5)*.4))-smoothstep(rb-.07,rb-.13,length(gf+(vec2(hb,h2(gi+9.))-.5)*.4));",
    "  c+=vec3(.95,.88,.60)*bo*step(.78,hb)*exp(s*42.)*.7;",
    " }else{",
    "  c=sol;c*=1.-.42*exp(-s*70.);",
    " }",
    " c+=vec3(1.,.95,.72)*smoothstep(pxy*2.2,0.,abs(s))*.95*step(.001,E)*step(E,.999);",
    // Grao fino
    " c+=(h2(px+fract(T)*7.)-.5)*.018;",
    // Moldura: coluna inclinada, cantos, borracha
    " vec2 cen=R*.5;float mg=min(R.x,R.y)*.018;float rad=min(R.x,R.y)*.05;",
    " vec2 q=abs(px-cen)-(R*.5-vec2(mg)-rad);float box=length(max(q,0.))+min(max(q.x,q.y),0.)-rad;",
    " float inc=asp>1.1?.86:.66;vec2 a0=vec2(R.x*inc,0.);vec2 a1=vec2(R.x*1.02,R.y*(asp>1.1?.62:.34));vec2 ab=normalize(a1-a0);vec2 no=vec2(ab.y,-ab.x);float pl=dot(px-a0,no);",
    " float k=rad*.8;float h=clamp(.5+.5*(box-pl)/k,0.,1.);float sdf=mix(pl,box,h)+k*h*(1.-h);",
    " c*=1.-.16*smoothstep(-16.,0.,sdf);",
    " vec3 bor=vec3(.024,.026,.03)+vec3(.05)*smoothstep(0.,2.,sdf)*smoothstep(4.,2.,sdf);",
    " c=mix(c,bor,smoothstep(-1.,1.,sdf));",
    // Retrovisor do lado do passageiro
    " vec2 mc=asp>1.1?vec2(asp*.915,.855):vec2(asp*.85,.385);vec2 sz=asp>1.1?vec2(.092,.058):vec2(.078,.04);",
    " vec2 mq=(vec2(uv.x*asp,uv.y)-mc)/sz;mq.x+=mq.y*.16;float mo=pow(pow(abs(mq.x),2.6)+pow(abs(mq.y),2.6),1./2.6);",
    " float haste=smoothstep(sz.y*.34,sz.y*.2,abs(uv.y-(mc.y+sz.y*.45+(uv.x*asp-mc.x-sz.x*.6)*.28)))*smoothstep(mc.x+sz.x*.4,mc.x+sz.x*.7,uv.x*asp);",
    " vec3 casco=mix(vec3(.17,.175,.18),vec3(.025),smoothstep(-.9,.5,mq.y));",
    " c=mix(c,casco,max(smoothstep(1.02,.99,mo),haste));",
    " vec3 esp=mix(vec3(.74,.80,.82),vec3(.10,.115,.12),smoothstep(-.8,.55,mq.y+mq.x*.35));esp+=vec3(.3)*smoothstep(.16,.0,abs(mq.x+mq.y*.8+.28))*.55;",
    " c=mix(c,esp,smoothstep(.925,.895,mo));",
    " gl_FragColor=vec4(c,1.);}"
  ].join("\n");

  function Vidro(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) return null;
    function sh(tipo, src) { var s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {}; ["R", "T", "E", "N", "S"].forEach(function (k) { u[k] = gl.getUniformLocation(pr, k); });
    var eu = { e: .4, n: .75, sx: .72, sy: .22, t: 0, sujo: true };
    function tam() {
      var esc = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.5);
      var w = Math.max(1, Math.round(canvas.clientWidth * esc)), h = Math.max(1, Math.round(canvas.clientHeight * esc));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); eu.sujo = true; }
    }
    new ResizeObserver(tam).observe(canvas); tam();
    eu.desenha = function () {
      tam();
      gl.uniform2f(u.R, canvas.width, canvas.height); gl.uniform1f(u.T, eu.t); gl.uniform1f(u.E, eu.e); gl.uniform1f(u.N, eu.n); gl.uniform2f(u.S, eu.sx, eu.sy);
      gl.drawArrays(gl.TRIANGLES, 0, 3); eu.sujo = false;
    };
    return eu;
  }

  var visiveis = new Map();
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { visiveis.set(e.target, e.isIntersecting); }); }, { rootMargin: "80px" });
  function vigia(el) { visiveis.set(el, true); io.observe(el); }

  /* ---------- Heroi: pelicula puxada pelo rodo ou pela rolagem ---------- */
  var heroi = document.querySelector(".heroi");
  var vidroEl = heroi && heroi.querySelector(".vidro");
  var glH = null, H = null;
  if (heroi) {
    var cv = heroi.querySelector("canvas");
    glH = Vidro(cv);
    if (!glH) doc.classList.add("sem-gl");
    var rodo = heroi.querySelector(".rodo");
    var alvoRange = rodo ? rodo.querySelector("input") : null;
    var pagina = heroi.classList.contains("heroi--pagina");
    function bordaInicial() {
      var h1 = heroi.querySelector("h1"), alt = vidroEl.clientHeight;
      if (pagina) return trava((h1.offsetTop - 26) / alt, .13, .9);
      var fs = parseFloat(getComputedStyle(h1).fontSize);
      return trava((h1.offsetTop + fs * (innerWidth < 640 ? 1.48 : .56)) / alt, .13, .9);
    }
    var inicial = bordaInicial();
    H = { alvo: inicial, atual: calmo ? inicial : .13, rola: 0, sol: { x: innerWidth < 640 ? .5 : .72, y: innerWidth < 640 ? .16 : .2 }, solAlvo: { x: innerWidth < 640 ? .5 : .72, y: innerWidth < 640 ? .16 : .2 } };
    function reposiciona() { if (usadoRodo) return; inicial = bordaInicial(); H.alvo = inicial; if (alvoRange) alvoRange.value = Math.round(inicial * 100); }
    var usadoRodo = false;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposiciona);
    addEventListener("resize", reposiciona);
    var ativaSol = matchMedia("(pointer: fine)").matches;
    if (ativaSol) heroi.addEventListener("pointermove", function (e) {
      var r = vidroEl.getBoundingClientRect();
      H.solAlvo.x = trava((e.clientX - r.left) / r.width, .05, .95);
      H.solAlvo.y = trava((e.clientY - r.top) / r.height, .05, .95);
    });
    if (rodo) {
      var pegando = false;
      function aplica(y) {
        var r = vidroEl.getBoundingClientRect();
        H.alvo = trava((y - r.top) / r.height, .13, .97);
        alvoRange.value = Math.round(H.alvo * 100);
      }
      rodo.addEventListener("pointerdown", function (e) { pegando = true; rodo.setPointerCapture(e.pointerId); rodo.classList.add("pegando", "usado"); usadoRodo = true; e.preventDefault(); });
      rodo.addEventListener("pointermove", function (e) { if (pegando) aplica(e.clientY); });
      ["pointerup", "pointercancel"].forEach(function (n) { rodo.addEventListener(n, function () { pegando = false; rodo.classList.remove("pegando"); }); });
      alvoRange.addEventListener("input", function () { H.alvo = alvoRange.value / 100; usadoRodo = true; rodo.classList.add("usado"); });
    }
    if (alvoRange) alvoRange.value = Math.round(inicial * 100);
    vigia(heroi);
  }

  /* ---------- Tons ---------- */
  var tonsCv = document.getElementById("tons-vidro");
  var glT = tonsCv ? Vidro(tonsCv) : null;
  var FRASES = [
    [5, "Sem película, o sol entra inteiro: mais calor e mais claridade dentro do carro."],
    [35, "Película clara: reduz o brilho e o calor e deixa o vidro bem transparente."],
    [70, "Película média: mais conforto e privacidade sem atrapalhar a visão de quem dirige."],
    [101, "Película escura: máxima privacidade. Cada vidro tem um limite de escurecimento na lei, e a gente indica o tom certo para o seu carro."]
  ];
  var T = null;
  if (tonsCv) {
    var nivel = document.getElementById("nivel"), efeito = document.getElementById("efeito");
    T = { alvo: nivel.value / 100, atual: nivel.value / 100 };
    function frase() {
      var v = +nivel.value;
      for (var i = 0; i < FRASES.length; i++) if (v < FRASES[i][0]) { efeito.textContent = FRASES[i][1]; break; }
      nivel.setAttribute("aria-valuetext", efeito.textContent);
      T.alvo = v / 100;
    }
    nivel.addEventListener("input", frase); frase();
    if (glT) { glT.e = .9995; glT.sx = .62; glT.sy = .24; vigia(tonsCv); }
    else tonsCv.parentElement.style.background = "#222";
  }

  /* ---------- O carro: as peliculas em acao ---------- */
  var PERFIS = {
    nada: { a: 0, brilho: .5, calor: 1, raios: 1, sinal: 0, racha: 0 },
    tintada: { a: .87, brilho: .35, calor: .35, raios: 0, sinal: 0, racha: 0 },
    profissional: { a: .68, brilho: 1, calor: .25, raios: 0, sinal: 0, racha: 0 },
    carbono: { a: .78, brilho: 0, calor: .25, raios: 0, sinal: 1, racha: 0 },
    antivandalismo: { a: .42, brilho: .4, calor: .5, raios: 0, sinal: 0, racha: 1 },
    ceramica: { a: .2, brilho: .5, calor: 0, raios: 1, sinal: 0, racha: 0 }
  };
  var C_CORPO = new Path2D("M34 562C20 540 14 470 16 400C18 356 34 322 62 306C92 292 112 268 134 240C192 176 252 122 332 106C452 84 590 84 672 110C744 134 812 222 884 294C926 301 960 314 976 338C990 372 994 470 984 530C980 552 968 562 950 562Z");
  var C_FRENTE = new Path2D("M566 128L654 130C702 146 770 226 816 292L566 292Z");
  var C_TRAS = new Path2D("M528 126L402 128C344 132 296 156 250 206C226 232 208 262 196 292L528 292Z");
  var C_VIDROS = new Path2D(); C_VIDROS.addPath(C_FRENTE); C_VIDROS.addPath(C_TRAS);

  function Carro(canvas) {
    var ctx = canvas.getContext("2d");
    var s = { a: .87, brilho: .35, calor: .35, raios: 0, sinal: 0, racha: 0 };
    var desenhaE = 1, alvo = PERFIS.tintada, modo = "tintada", semFilme = false, quebrado = false, cacos = null, caindo = false, t = 0, sujo = true;
    function tam() {
      var d = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * d), h = Math.round(canvas.clientHeight * d);
      if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; sujo = true; }
    }
    new ResizeObserver(tam).observe(canvas); tam();

    function geraCacos() {
      var ox = 690, oy = 214, cx = [], n = 15, raios = [26, 62, 112, 182, 290], ang = [], i, j;
      function rnd(k) { var x = Math.sin(k * 73.13) * 43758.5; return x - Math.floor(x); }
      for (i = 0; i < n; i++) ang.push((i + rnd(i) * .6) / n * Math.PI * 2);
      function pt(i, j) { var a = ang[(i + n) % n], r = j < 0 ? 0 : raios[j] * (.86 + rnd(i * 7 + j) * .28); return [ox + Math.cos(a) * r, oy + Math.sin(a) * r]; }
      for (i = 0; i < n; i++) for (j = 0; j < raios.length; j++) {
        var q = [pt(i, j - 1), pt(i + 1, j - 1), pt(i + 1, j), pt(i, j)];
        var gx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, gy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
        cx.push({ q: q, gx: gx, gy: gy, x: 0, y: 0, r: 0, vx: (gx - ox) * .012 + (rnd(i + j * 3) - .5) * .8, vy: -.4 + rnd(i * 3 + j) * .8, vr: (rnd(i * 5 + j) - .5) * .09, atraso: j * 3 + rnd(i + j) * 8 });
      }
      return cx;
    }
    function caminho(q) { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (var i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); }

    function interior() {
      var g = ctx.createLinearGradient(0, 100, 0, 300);
      g.addColorStop(0, "#EAF1EF"); g.addColorStop(.7, "#CBD8D4"); g.addColorStop(1, "#8D9A97");
      ctx.fillStyle = g; ctx.fillRect(150, 90, 700, 220);
      // Arvores na janela oposta
      ctx.fillStyle = "#9DB39A"; ctx.beginPath(); ctx.ellipse(380, 268, 150, 50, 0, 0, 7); ctx.ellipse(700, 280, 130, 40, 0, 0, 7); ctx.fill();
      // Banco e motorista, fora de foco
      ctx.shadowBlur = 11 * desenhaE; ctx.shadowColor = "#23272A";
      ctx.fillStyle = "#23272A";
      ctx.beginPath(); ctx.roundRect(340, 176, 66, 62, 16); ctx.fill();
      ctx.fillRect(322, 232, 104, 70);
      ctx.beginPath(); ctx.roundRect(574, 188, 48, 60, 14); ctx.fill();
      ctx.fillStyle = "#32383C";
      ctx.beginPath(); ctx.ellipse(640, 200, 33, 39, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(590, 300); ctx.quadraticCurveTo(596, 246, 640, 242); ctx.quadraticCurveTo(690, 246, 700, 300); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
      // Calor entrando
      if (s.calor > .01) { var ca = ctx.createRadialGradient(650, 240, 10, 650, 240, 300); ca.addColorStop(0, "rgba(255,84,20," + (.6 * s.calor) + ")"); ca.addColorStop(1, "rgba(255,120,20," + (.14 * s.calor) + ")"); ctx.fillStyle = ca; ctx.fillRect(150, 90, 700, 220); }
    }

    function desenha() {
      tam();
      if (!canvas.width) return;
      var e = canvas.width / 650;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(e, 0, 0, e, -240 * e, -90 * e); desenhaE = e;

      // Sol
      var sg = ctx.createRadialGradient(832, 138, 6, 832, 138, 47);
      sg.addColorStop(0, "rgba(252,207,8,.55)"); sg.addColorStop(1, "rgba(252,207,8,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(832, 138, 47, 0, 7); ctx.fill();
      ctx.fillStyle = "#FFE45C"; ctx.beginPath(); ctx.arc(832, 138, 19, 0, 7); ctx.fill();

      // Carroceria
      var gb = ctx.createLinearGradient(0, 100, 0, 570);
      gb.addColorStop(0, "#FFEB7A"); gb.addColorStop(.2, "#FCCF08"); gb.addColorStop(.44, "#F2C200"); gb.addColorStop(.72, "#C79E00"); gb.addColorStop(1, "#5E4B00");
      ctx.fillStyle = gb; ctx.fill(C_CORPO);
      // Vinco e luz na lataria
      ctx.strokeStyle = "rgba(255,250,200,.85)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(16, 412); ctx.bezierCurveTo(300, 392, 700, 390, 988, 404); ctx.stroke();
      ctx.strokeStyle = "rgba(92,72,0,.4)"; ctx.beginPath(); ctx.moveTo(16, 418); ctx.bezierCurveTo(300, 398, 700, 396, 988, 410); ctx.stroke();
      // Reflexos na lataria: ceu, linha da rua e brilho do sol
      ctx.save(); ctx.clip(C_CORPO);
      var rf = ctx.createLinearGradient(0, 306, 0, 392);
      rf.addColorStop(0, "rgba(255,255,255,.34)"); rf.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rf; ctx.fillRect(0, 306, 1000, 86);
      var rr = ctx.createLinearGradient(0, 430, 0, 520);
      rr.addColorStop(0, "rgba(58,44,0,0)"); rr.addColorStop(.16, "rgba(58,44,0,.42)"); rr.addColorStop(.5, "rgba(58,44,0,.12)"); rr.addColorStop(1, "rgba(255,240,170,.18)");
      ctx.fillStyle = rr; ctx.beginPath(); ctx.moveTo(0, 430);
      ctx.lineTo(1000, 430);
      ctx.lineTo(1000, 540); ctx.lineTo(0, 540); ctx.closePath(); ctx.fill();
      var gl = ctx.createRadialGradient(620, 100, 2, 620, 100, 150);
      gl.addColorStop(0, "rgba(255,255,255,.8)"); gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl; ctx.fillRect(460, 60, 320, 90);
      ctx.restore();
      // Farol, lanterna, soleira e rodas
      ctx.fillStyle = "#FFF7CF"; ctx.beginPath(); ctx.moveTo(934, 326); ctx.quadraticCurveTo(972, 334, 984, 368); ctx.lineTo(942, 362); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#7A1F12"; ctx.beginPath(); ctx.roundRect(14, 348, 26, 50, 8); ctx.fill();
      ctx.fillStyle = "#17181A"; ctx.fillRect(40, 538, 930, 24);
      [[176, 540], [806, 540]].forEach(function (w) {
        ctx.fillStyle = "#121416"; ctx.beginPath(); ctx.arc(w[0], w[1], 92, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#050506"; ctx.beginPath(); ctx.arc(w[0], w[1], 76, 0, 7); ctx.fill();
        ctx.fillStyle = "#8B8E8F"; ctx.beginPath(); ctx.arc(w[0], w[1], 42, 0, 7); ctx.fill();
        ctx.fillStyle = "#2A2C2E"; ctx.beginPath(); ctx.arc(w[0], w[1], 13, 0, 7); ctx.fill();
        ctx.strokeStyle = "#2A2C2E"; ctx.lineWidth = 7;
        for (var a = 0; a < 5; a++) { var an = a / 5 * 6.283 + t * 0; ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(w[0] + Math.cos(an) * 40, w[1] + Math.sin(an) * 40); ctx.stroke(); }
      });

      // Colunas e contorno escuro das janelas
      ctx.fillStyle = "#0E0F10";
      ctx.fill(new Path2D("M584 110L672 112C724 132 800 222 842 304L170 304C190 250 216 214 246 186C298 138 346 116 404 112Z"));

      // Vidros
      ctx.save(); ctx.clip(C_VIDROS); interior(); ctx.restore();
      var buraco = caindo || (quebrado && semFilme);
      ctx.save();
      if (buraco) ctx.clip(C_TRAS); else ctx.clip(C_VIDROS);
      ctx.fillStyle = s.brilho < .15 ? "rgba(24,25,26," + s.a + ")" : "rgba(13,15,17," + s.a + ")";
      ctx.fillRect(150, 90, 700, 220);
      // Reflexos fixos no vidro: copa das arvores e duas faixas de ceu
      var ra = ctx.createLinearGradient(0, 222, 0, 294);
      ra.addColorStop(0, "rgba(24,44,28,0)"); ra.addColorStop(1, "rgba(24,44,28,.34)");
      ctx.fillStyle = ra; ctx.fillRect(150, 222, 700, 72);
      if (s.brilho > .1) {
        ctx.fillStyle = "rgba(255,255,255," + (.1 * Math.min(1, s.brilho * 2)) + ")";
        ctx.beginPath(); ctx.moveTo(300, 110); ctx.lineTo(392, 110); ctx.lineTo(288, 300); ctx.lineTo(196, 300); ctx.fill();
        ctx.beginPath(); ctx.moveTo(650, 110); ctx.lineTo(686, 110); ctx.lineTo(586, 300); ctx.lineTo(550, 300); ctx.fill();
      }
      // Brilho que atravessa o vidro
      if (s.brilho > .02) {
        var bx = ((t * 54) % 900) - 100;
        var gs = ctx.createLinearGradient(bx - 90, 100, bx + 90, 300);
        gs.addColorStop(0, "rgba(255,255,255,0)"); gs.addColorStop(.5, "rgba(255,255,255," + (.42 * s.brilho) + ")"); gs.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gs; ctx.fillRect(150, 90, 700, 220);
      }
      ctx.restore();

      // Vidro rachado: a pelicula segura os cacos
      if (quebrado && cacos) {
        if (!buraco) {
          ctx.save(); ctx.clip(C_FRENTE);
          ctx.strokeStyle = "rgba(240,248,250,.9)"; ctx.lineWidth = 1.2; ctx.lineJoin = "round";
          cacos.forEach(function (c) { caminho(c.q); ctx.stroke(); });
          ctx.fillStyle = "rgba(255,255,255,.08)"; cacos.forEach(function (c, i) { if (i % 4 === 0) { caminho(c.q); ctx.fill(); } });
          ctx.restore();
        } else {
          cacos.forEach(function (c) {
            if (c.y > 520) return;
            ctx.save();
            ctx.translate(c.gx + c.x, c.gy + c.y); ctx.rotate(c.r); ctx.translate(-c.gx, -c.gy);
            ctx.clip(C_FRENTE);
            caminho(c.q);
            ctx.fillStyle = "rgba(226,240,242,.6)"; ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1; ctx.stroke();
            ctx.restore();
          });
        }
      }

      // Raios de calor ate o vidro
      if (s.raios > .01) {
        ctx.save(); ctx.strokeStyle = "rgba(255,120,24," + (.85 * s.raios) + ")"; ctx.lineWidth = 3; ctx.lineCap = "round";
        for (var i = 0; i < 5; i++) {
          var fv = .18 + i * .15, x0 = 816 - i * 2, y0 = 150 + i * 2, x1 = 654 + 162 * fv - (semFilme ? 90 : 0), y1 = 130 + 162 * fv + (semFilme ? 60 : 0);
          ctx.beginPath();
          for (var k = 0; k <= 26; k++) {
            var f = k / 26, px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f, w = Math.sin(f * 11 - t * 3.4 + i) * 2.2;
            if (k) ctx.lineTo(px + w * .7, py + w * .7); else ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // Friso, macaneta e retrovisor
      var cr = ctx.createLinearGradient(0, 300, 0, 308); cr.addColorStop(0, "#F4F6F6"); cr.addColorStop(1, "#6E7172"); ctx.fillStyle = cr; ctx.fillRect(166, 301, 690, 6);
      ctx.strokeStyle = "rgba(70,55,0,.7)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(546, 306); ctx.lineTo(542, 538); ctx.moveTo(838, 306); ctx.lineTo(846, 450); ctx.moveTo(270, 306); ctx.lineTo(276, 538); ctx.stroke();
      ctx.fillStyle = "#7F6600"; ctx.beginPath(); ctx.roundRect(586, 344, 72, 15, 7); ctx.fill();
      ctx.fillStyle = "#FFEC8C"; ctx.beginPath(); ctx.roundRect(590, 345, 64, 5, 3); ctx.fill();
      ctx.fillStyle = "#101112"; ctx.beginPath(); ctx.roundRect(816, 294, 30, 15, 4); ctx.fill();
      var mg = ctx.createLinearGradient(0, 262, 0, 308); mg.addColorStop(0, "#FFE768"); mg.addColorStop(.55, "#F0BE00"); mg.addColorStop(1, "#8A6E00");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.roundRect(826, 262, 58, 42, 15); ctx.fill();

      // Sinais de celular, GPS e radio atravessando
      if (s.sinal > .02) {
        ctx.save(); ctx.lineWidth = 3;
        for (var j = 0; j < 7; j++) {
          var f2 = ((t * .22 + j / 7) % 1), rr = f2 * 620;
          ctx.strokeStyle = "rgba(252,207,8," + (s.sinal * .9 * (1 - f2)) + ")";
          ctx.beginPath(); ctx.arc(232, 96, rr, 0, 7); ctx.stroke();
        }
        
        ctx.globalAlpha = s.sinal; ctx.fillStyle = "#FCCF08"; ctx.beginPath(); ctx.roundRect(662, 214, 26, 46, 5); ctx.fill();
        ctx.fillStyle = "#121416"; ctx.fillRect(666, 220, 18, 30);
        ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      sujo = false;
    }

    return {
      modo: function (m) { modo = m; alvo = semFilme ? PERFIS.nada : PERFIS[m]; if (m !== "antivandalismo") this.repara(); sujo = true; },
      alterna: function () {
        semFilme = !semFilme;
        alvo = semFilme ? PERFIS.nada : PERFIS[modo];
        if (quebrado) { caindo = semFilme; if (!semFilme && cacos) cacos.forEach(function (c) { c.x = c.y = c.r = 0; c.t = 0; }); }
        sujo = true; return semFilme;
      },
      quebra: function () { cacos = cacos || geraCacos(); quebrado = true; caindo = semFilme; sujo = true; },
      repara: function () { quebrado = false; caindo = false; if (cacos) cacos.forEach(function (c) { c.x = c.y = c.r = 0; c.t = 0; }); sujo = true; },
      get quebrado() { return quebrado; },
      get semFilme() { return semFilme; },
      desenha: desenha,
      passo: function (dt) {
        t += dt;
        ["a", "brilho", "calor", "raios", "sinal"].forEach(function (k) { s[k] += (alvo[k] - s[k]) * Math.min(1, dt * 5); });
        if (caindo && cacos) cacos.forEach(function (c) {
          c.t = (c.t || 0) + dt * 60; if (c.t < c.atraso) return;
          c.vy += dt * 38; c.x += c.vx * dt * 60; c.y += c.vy * dt * 60; c.r += c.vr * dt * 60;
        });
      },
      imediato: function () { Object.keys(s).forEach(function (k) { s[k] = alvo[k]; }); if (caindo && cacos) cacos.forEach(function (c) { c.y = 999; }); }
    };
  }

  var carroCv = document.getElementById("carro");
  var carro = carroCv ? Carro(carroCv) : null;
  if (carro) {
    var nome = document.getElementById("palco-nome"), comparar = document.getElementById("comparar"), aviso = document.getElementById("aviso-vidro");
    var quebrar = document.getElementById("quebrar"), arts = document.querySelectorAll(".fita article");
    function rotula() {
      var atual = document.querySelector(".fita article.ativa");
      var base = atual ? atual.querySelector("h3").textContent.replace(/\s+/g, " ").replace("- ", "-") : "";
      nome.textContent = carro.semFilme ? "Sem película" : base;
      nome.classList.toggle("repete", !carro.semFilme);
    }
    function ativa(art) {
      arts.forEach(function (a) { a.classList.toggle("ativa", a === art); });
      carro.modo(art.dataset.filme);
      if (art.dataset.filme !== "antivandalismo" && quebrar) { quebrar.textContent = "Quebrar o vidro"; if (aviso) aviso.textContent = ""; }
      rotula();
    }
    var ioF = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) ativa(e.target); }); }, { rootMargin: "-48% 0px -48% 0px" });
    arts.forEach(function (a) { ioF.observe(a); });
    if (arts[0]) ativa(arts[0]);
    comparar.addEventListener("click", function () {
      var sem = carro.alterna();
      comparar.setAttribute("aria-pressed", sem);
      comparar.textContent = sem ? "Voltar a película" : "Ver sem película";
      if (carro.quebrado && aviso) aviso.textContent = sem ? "Sem película, os cacos caem e o carro fica aberto." : "Com a película, os cacos ficam unidos.";
      rotula();
      if (calmo) { carro.imediato(); carro.desenha(); }
    });
    if (quebrar) quebrar.addEventListener("click", function () {
      if (carro.quebrado) { carro.repara(); quebrar.textContent = "Quebrar o vidro"; aviso.textContent = ""; }
      else { carro.quebra(); quebrar.textContent = "Trocar o vidro"; aviso.textContent = carro.semFilme ? "Sem película, os cacos caem e o carro fica aberto." : "Com a película, os cacos ficam unidos. Agora veja sem ela."; }
      if (calmo) { carro.imediato(); carro.desenha(); }
    });
    vigia(carroCv);
  }

  /* ---------- Barra do celular ---------- */
  var barra = document.querySelector(".barra"), portaEl = document.querySelector(".porta");
  function aoRolar() {
    var y = scrollY;
    if (heroi) {
      var r = heroi.getBoundingClientRect();
      var curso = r.height - innerHeight;
      if (H && curso > 1) { var p = trava(-r.top / curso, 0, 1); H.rola = p * p * (3 - 2 * p); }
      var limite = nav ? nav.offsetHeight + 16 + (portaEl ? portaEl.offsetHeight : 0) : 80;
      if (nav) nav.classList.toggle("com-fundo", curso > 1 ? r.bottom < limite : y > 30);
      if (barra) barra.classList.toggle("visivel", r.bottom < limite);
    } else if (nav) nav.classList.add("com-fundo");
  }
  addEventListener("scroll", aoRolar, { passive: true });
  addEventListener("resize", aoRolar);
  aoRolar();

  /* ---------- Um unico motor de movimento ---------- */
  var ant = performance.now(), quadro = 0;
  function laco(ag) {
    var dt = Math.min(.05, (ag - ant) / 1000); ant = ag; quadro++;
    if (H && vidroEl && visiveis.get(heroi)) {
      var fim = H.alvo + (1 - H.alvo) * H.rola;
      var lerp = calmo ? 1 : 1 - Math.exp(-dt * (H.atual < H.alvo - .05 ? 2.6 : 10));
      H.atual += (fim - H.atual) * lerp;
      var altura = vidroEl.clientHeight;
      heroi.style.setProperty("--borda", (H.atual * altura).toFixed(1) + "px");
      if (rodo) rodo.style.opacity = H.atual > .9 ? 0 : 1;
      if (glH) {
        H.sol.x += (H.solAlvo.x - H.sol.x) * .06; H.sol.y += (H.solAlvo.y - H.sol.y) * .06;
        var mudou = Math.abs(glH.e - H.atual) > .0004 || Math.abs(glH.sx - H.sol.x) > .0008 || Math.abs(glH.sy - H.sol.y) > .0008;
        glH.e = H.atual; glH.sx = H.sol.x; glH.sy = H.sol.y;
        if (!calmo) glH.t += dt;
        if (mudou || glH.sujo || (!calmo && quadro % 4 === 0)) glH.desenha();
      }
    }
    if (T && glT && visiveis.get(tonsCv)) {
      var d = T.alvo - T.atual;
      T.atual += d * (calmo ? 1 : .14);
      var vm = Math.abs(glT.n - T.atual) > .001;
      glT.n = T.atual;
      if (!calmo) glT.t += dt;
      if (vm || glT.sujo || (!calmo && quadro % 6 === 0)) glT.desenha();
    }
    if (carro && visiveis.get(carroCv)) {
      carro.passo(calmo ? 1 : dt);
      if (calmo) { if (quadro < 3) carro.desenha(); }
      else carro.desenha();
    }
    requestAnimationFrame(laco);
  }
  requestAnimationFrame(laco);
})();