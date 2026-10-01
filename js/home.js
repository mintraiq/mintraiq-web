/* Homepage interactions: the app-screen carousel, the receipt sorter, and the feature
   explorer's tabs and hotspots. Runs on first load and on every Turbo visit. */
(function(){
  function boot(){
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stage=document.getElementById('stage');
    if(!stage||stage.dataset.booted)return;
    stage.dataset.booted='1';
    document.documentElement.classList.add('js');


    function tpl(id){return document.getElementById('t-'+id).content.firstElementChild.cloneNode(true);}

    /* ---------- hero carousel ---------- */
    var slides=[
      {id:'home',t:'Start from one screen',s:'Scan a receipt, upload a statement, or review what’s new.'},
      {id:'tx',t:'Every transaction, categorised',s:'Statements become one list, sorted for you.'},
      {id:'receipt',t:'Receipts, read line by line',s:'Twelve items read, nothing typed.'},
      {id:'hub',t:'AI forecast, at a glance',s:'Where your money is heading, with an end-of-year projection.'},
      {id:'goals',t:'Set a goal in a tap',s:'A rough aim is enough to start.'}
    ];
    var dots=document.getElementById('dots');
    var active=2,n=slides.length,timer=null,stopped=reduce,io;
    var pauseBtn=document.getElementById('pause');
    slides.forEach(function(sl,i){
      var d=document.createElement('div');d.className='slot';d.setAttribute('role','group');
      d.setAttribute('aria-roledescription','slide');d.setAttribute('aria-label',(i+1)+' of '+n+': '+sl.t);
      d.appendChild(tpl(sl.id));d.addEventListener('click',function(){go(i);});stage.appendChild(d);
      var b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Show '+sl.t);
      b.addEventListener('click',function(){go(i);});dots.appendChild(b);
    });
    function render(){
      [].forEach.call(stage.children,function(el,i){
        var off=((i-active)%n+n)%n; if(off>n/2)off-=n;
        el.dataset.pos=Math.abs(off)<=2?String(off):'hide';
        el.setAttribute('aria-hidden',off!==0);
      });
      [].forEach.call(dots.children,function(b,i){b.setAttribute('aria-current',i===active);});
      document.getElementById('capT').textContent=slides[active].t;
      document.getElementById('capS').textContent=slides[active].s;
    }
    // Any manual move hands control to the visitor, so rotation stops for good (WCAG 2.2.2).
    function go(i){active=(i+n)%n;stopped=true;render();restart();}
    document.getElementById('prev').onclick=function(){go(active-1);};
    document.getElementById('next').onclick=function(){go(active+1);};
    function tick(){if(!stage.isConnected){teardown();return;}active=(active+1)%n;render();}
    function restart(){
      clearInterval(timer);
      pauseBtn.textContent=stopped?'Play':'Pause';pauseBtn.setAttribute('aria-pressed',stopped);
      if(!stopped)timer=setInterval(tick,5200);
    }
    pauseBtn.hidden=reduce;
    pauseBtn.onclick=function(){stopped=!stopped;restart();};
    stage.addEventListener('mouseenter',function(){clearInterval(timer);});
    stage.addEventListener('mouseleave',restart);
    stage.addEventListener('focusin',function(){clearInterval(timer);});
    render();restart();
    // Turbo swaps <body> without reloading the window, so anything still running here would outlive the page.
    function teardown(){clearInterval(timer);if(io)io.disconnect();window.removeEventListener('resize',placeSpots);}
    document.addEventListener('turbo:before-render',teardown,{once:true});

    /* ---------- sorter (signature) ---------- */
    var sorter=document.getElementById('sorter'),lines=sorter.querySelectorAll('.ln'),sortTok=0;
    function runSort(){
      var tok=++sortTok;
      var rows=sorter.querySelectorAll('.xl');
      [].forEach.call(lines,function(l,i){l.classList.remove('tag');if(rows[i])rows[i].classList.remove('in');});
      if(reduce){[].forEach.call(lines,function(l,i){l.classList.add('tag');if(rows[i])rows[i].classList.add('in');});return;}
      [].forEach.call(lines,function(l,i){setTimeout(function(){
        if(tok!==sortTok)return;
        l.classList.add('tag');
        if(rows[i])rows[i].classList.add('in');
      },250+i*130);});
    }
    if('IntersectionObserver' in window){
      io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting;})){io.disconnect();runSort();}},{threshold:.3});
      io.observe(sorter);
    } else runSort();
    document.getElementById('replay').onclick=runSort;

    /* ---------- pillar tabs + hotspots ---------- */
    document.querySelectorAll('.dwrap').forEach(function(w){w.insertBefore(tpl(w.dataset.screen),w.firstChild);});
    var tabs=[].slice.call(document.querySelectorAll('.ptab'));
    function select(t,focus){
      tabs.forEach(function(x){var on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;
        document.getElementById(x.getAttribute('aria-controls')).hidden=!on;});
      if(focus)t.focus();
    }
    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){select(t);});
      t.addEventListener('keydown',function(e){
        if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();
          select(tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length],true);}
      });
    });
    document.querySelectorAll('.panel').forEach(function(p){
      function hi(i){p.querySelectorAll('[data-i]').forEach(function(el){el.classList.toggle('on',el.dataset.i===i);});}
      p.querySelectorAll('[data-i]').forEach(function(el){
        ['mouseenter','focus','click'].forEach(function(ev){el.addEventListener(ev,function(){hi(el.dataset.i);});});
      });
      hi('1');
    });
    /* pin each hotspot to the edge of the element it explains */
    function placeSpots(){
      document.querySelectorAll('.panel:not([hidden]) .dwrap').forEach(function(w){
        var wr=w.getBoundingClientRect(); if(!wr.width)return;
        w.querySelectorAll('.spot').forEach(function(sp){
          var t=w.querySelector('.bd '+sp.dataset.t); if(!t)return;
          var r=t.getBoundingClientRect(),side=sp.dataset.s,x,y;
          if(side==='t'){x=r.left+r.width/2;y=r.top;}
          else{x=side==='l'?r.left-10:r.right+10;y=r.top+Math.min(r.height/2,28);}
          sp.style.left=((x-wr.left)/wr.width*100)+'%';sp.style.top=((y-wr.top)/wr.height*100)+'%';
        });
      });
    }
    tabs.forEach(function(t){t.addEventListener('click',function(){requestAnimationFrame(placeSpots);});
      t.addEventListener('keydown',function(){requestAnimationFrame(placeSpots);});});
    window.addEventListener('resize',placeSpots);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(placeSpots);
    placeSpots();
  }
  document.addEventListener('turbo:load',boot);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
