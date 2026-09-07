import json, math, numpy as np
rows=[r for r in json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'basket-2026-09-06.json'))) if not r.get('error')]
hist=[r for r in rows if r.get('change30') is not None]
KEYS=['creator','community','ip_momentum','editorial','competitive','scarcity','jp_hype','jp_release']
def feat(r):  # the same quantity the score uses: level/5 × direction, per signal
    return [ (r['signals'].get(k,{}).get('level',0)/5.0) * r['signals'].get(k,{}).get('dir',0) for k in KEYS ]
def rank(a):
    order=np.argsort(a); rk=np.empty(len(a)); rk[order]=np.arange(1,len(a)+1); return rk
def spearman(a,b): return float(np.corrcoef(rank(np.array(a)), rank(np.array(b)))[0,1])
def auc(score, label):
    pos=[s for s,l in zip(score,label) if l]; neg=[s for s,l in zip(score,label) if not l]
    if not pos or not neg: return float('nan')
    wins=sum(1.0 if p>n else 0.5 if p==n else 0 for p in pos for n in neg); return wins/(len(pos)*len(neg))
print(f"reports {len(rows)} | with 30d history {len(hist)} | games {dict((g,sum(1 for r in hist if r['game']==g)) for g in ('pokemon','mtg','yugioh'))}")
sc=np.array([r['score'] for r in hist]); ch=np.array([r['change30'] for r in hist]); up=ch>0
print(f"score: mean {sc.mean():.1f} sd {sc.std():.1f} min {sc.min()} max {sc.max()} | at exactly 50: {int((sc==50).sum())} of {len(sc)}")
print(f"30d move: median {np.median(ch):+.1f}% | rose {int(up.sum())} | fell {int((~up).sum())}")
print(f"score vs 30d move: spearman {spearman(sc,ch):+.2f} | AUC(score → rose) {auc(sc,up):.2f} (0.5 = coin flip)")
for lo,hi,name in [(0,49,'<50'),(50,50,'=50'),(51,60,'51-60'),(61,100,'>60')]:
    m=(sc>=lo)&(sc<=hi)
    if m.sum(): print(f"  score {name:>5}: n={int(m.sum()):2d} median move {np.median(ch[m]):+6.1f}%  rose {int(up[m].sum())}/{int(m.sum())}")
ev=np.array([r['evidence'] for r in hist])
print(f"evidence%: mean {ev.mean():.0f} | spearman(evidence, |move|) {spearman(ev, np.abs(ch)):+.2f}")
print("\nper-signal: mean level | share with a source | spearman(level×dir, move)")
X=np.array([feat(r) for r in hist])
for i,k in enumerate(KEYS):
    lv=[r['signals'].get(k,{}).get('level',0) for r in hist]; src=[1 if r['signals'].get(k,{}).get('sources',0) else 0 for r in hist]
    col=X[:,i]; sp = spearman(col,ch) if np.std(col)>0 else float('nan')
    print(f"  {k:12s} L{np.mean(lv):.1f}  sourced {np.mean(src)*100:3.0f}%  rho {sp:+.2f}")
# logistic fit: P(rose) from the 8 signal contributions; leave-one-out AUC to keep it honest
def fit(Xa, ya, l2=1.0, iters=3000, lr=0.1):
    w=np.zeros(Xa.shape[1]+1); Xb=np.hstack([Xa, np.ones((len(Xa),1))])
    for _ in range(iters):
        p=1/(1+np.exp(-Xb@w)); g=Xb.T@(p-ya)/len(ya); g[:-1]+=l2*w[:-1]/len(ya); w-=lr*g
    return w
y=up.astype(float); w=fit(X,y)
p_in=1/(1+np.exp(-(np.hstack([X,np.ones((len(X),1))])@w)))
loo=[]
for i in range(len(X)):
    m=np.arange(len(X))!=i; wi=fit(X[m],y[m]); loo.append(1/(1+np.exp(-(np.append(X[i],1)@wi))))
print(f"\nlogistic fit on 8 contributions → P(rose): in-sample AUC {auc(p_in,up):.2f} | leave-one-out AUC {auc(np.array(loo),up):.2f} | current score AUC {auc(sc,up):.2f}")
wabs=np.abs(w[:-1]); tot=wabs.sum() or 1
print("fitted weight share (sign = direction of effect):")
for k,wi in sorted(zip(KEYS,w[:-1]), key=lambda t:-abs(t[1])): print(f"  {k:12s} {wi:+.2f}  share {abs(wi)/tot*100:3.0f}%")
print("\nbiggest misses (score says up, price fell / score says down, price rose):")
for r in sorted(hist, key=lambda r: -abs((r['score']-50)/50) * abs(r['change30']))[:8]:
    print(f"  {r['game']:7s} {r['name'][:30]:30s} score {r['score']:3d} ev {r['evidence']:3d}%  30d {r['change30']:+7.1f}%  label {r['label']}")
json.dump({'n':len(hist),'spearman':spearman(sc,ch),'auc_score':auc(sc,up),'auc_fit_loo':auc(np.array(loo),up),'weights':dict(zip(KEYS,[float(x) for x in w[:-1]]))}, open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'fit-summary-2026-09-06.json'),'w'), indent=1)
