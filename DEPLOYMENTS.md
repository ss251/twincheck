# Deployments

## Monad Testnet (chain id `10143`)

| Field | Value |
|-------|--------|
| Network | Monad Testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | https://testnet.monadvision.com |

### DoneStamp (shipping entry)

| Field | Value |
|-------|--------|
| Address | [`0x6e234b4839641158B4E88Db59037B178BfcC31C8`](https://testnet.monadvision.com/address/0x6e234b4839641158B4E88Db59037B178BfcC31C8) |
| Worker (principal A) | `0xB99348aCC284E70cD832Fec09a0fC4A88879b5ac` |
| Accepter (principal B) | `0xe6781A81704D9eaCe07AAc3c22D5bBC30C90417B` |
| Deploy tx | [`0xfe71635a93f7459fa021c71c0a7fc80db650e9e531d5f45c608480bffeca8940`](https://testnet.monadvision.com/tx/0xfe71635a93f7459fa021c71c0a7fc80db650e9e531d5f45c608480bffeca8940) |
| Verified source | **exact_match** (Sourcify / BlockVision) |
| Explorer | https://testnet.monadvision.com/address/0x6e234b4839641158B4E88Db59037B178BfcC31C8 |

### Live demo receipts

| Path | Tx |
|------|-----|
| Worker **commit** (allow) | [`0x4a8f360c…941d58b`](https://testnet.monadvision.com/tx/0x4a8f360c8c1ab4196eabd67c0ef890bbf8de5e7f71f833e2682023a61941d58b) |
| Accepter **accept** (allow → isDone) | [`0x727de712…576b888`](https://testnet.monadvision.com/tx/0x727de71290d6a18ef510c9d678009cb86318fa2fbde83a57316c5c0d9576b888) |
| Worker **commit** (deny task) | [`0x125a293f…a24baae`](https://testnet.monadvision.com/tx/0x125a293f31c108d8ccd55319ea3c27a4acb6405257dbb95c6bffe0df2a24baae) |
| Accepter **Denied** (wrong evidence) | [`0xea27e5ae…79447bd`](https://testnet.monadvision.com/tx/0xea27e5ae67e1e7f6be1bf0ced8470ffa0cce15b42f06aae63877847db79447bd) |

### Dashboard

| Field | Value |
|-------|--------|
| Public URL | https://dashboard-pink-one-12.vercel.app |
| Env | `VITE_DONESTAMP=0x6e234b4839641158B4E88Db59037B178BfcC31C8` |

### Historical (superseded — not the Spark entry)

FleetLedger `0x3CE554b355002d6cc5d07Dd670c149815aFa3d14` remains onchain as prior experiment; **submission is DoneStamp**.
