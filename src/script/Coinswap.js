import { Ledger } from './Ledger'


const fee = {
    amount: [
        { denom: 'uiris', amount: process.env.VUE_APP_HUB_TX_FEE }
    ],
    gasLimit: '200000'
}

const chainID = process.env.VUE_APP_HUB_CHAIN_ID
const slippageRate = 0.01

export class CoinSwap {
    constructor(client) {
        this.client = client
        this.ledger = new Ledger()
    }

    sendSwapTx(input, output, recipient, isBuyOrder) {
        if (isBuyOrder) {
            input.amount = input.amount * (1 + slippageRate)
        } else {
            output.amount = output.amount * (1 - slippageRate)
        }
        return this._sendRawTransaction('swap_order', {
            input: input,
            output: output,
            recipient: recipient,
            isBuyOrder: isBuyOrder
        })
    }

    sendAddLiquidityTx(maxToken, exactIrisAmt, minLiquidity, isCreate) {
        if (!isCreate) {
            maxToken.amount = maxToken.amount * (1 + slippageRate)
        }
        minLiquidity = minLiquidity * (1 - slippageRate)
        return this._sendRawTransaction('add_liquidity', {
            maxToken: maxToken,
            exactIrisAmt: exactIrisAmt,
            minLiquidity: minLiquidity
        })
    }

    sendRemoveLiquidityTx(withdrawLiquidity, minIrisAmt, minToken) {
        minIrisAmt = minIrisAmt * (1 - slippageRate)
        minToken = minToken * (1 - slippageRate)
        return this._sendRawTransaction('remove_liquidity', {
            withdrawLiquidity: withdrawLiquidity,
            minIrisAmt: minIrisAmt,
            minToken: minToken
        })
    }

    _sendRawTransaction(type, req) {
        let parent = this
        return this.ledger.getAddressAndPubKey().then(async account => {
            window.console.log(account)
            let result = await parent.client.getAccount(account.addr)
            let acc = result.account
            let msgs = null
            switch (type) {
                case 'swap_order': {
                    msgs = this._createMsgSwap(account.addr, req)
                    break
                }
                case 'add_liquidity': {
                    msgs = this._createAddLiquidityMsg(account.addr, req)
                    break
                }
                case 'remove_liquidity': {
                    msgs = this._createRemoveLiquidityMsg(account.addr, req)
                    break
                }
                default: {
                    throw new Error('unsupport msgs')
                }
            }
            let tx = {
                chain_id: chainID,
                account_number: acc.account_number,
                sequence: acc.sequence,
                fee: fee,
                msgs: msgs
            }
            window.console.log(tx)

            let stdTx = parent.client.getBuilder().buildTx(tx)
            window.console.log(account.pubKey)

            let rawPubKey = crypto.Amino.MarshalBinary('tendermint/PubKeySecp256k1', account.pubKey)
            let pubKey = crypto.Codec.Hex.bytesToHex(rawPubKey)

            stdTx.setPubKey(pubKey);
            let signMsg = JSON.stringify(stdTx.getSignDoc())

            return parent.ledger.signTx(signMsg).then(signature => {
                stdTx.SetSignature({ pub_key: account.pubKey, signature: signature })
                let payload = stdTx.GetData()
                return parent.client.sendRawTransaction(payload, { mode: 'commit' })
            }).catch(e => {
                window.console.log(e)
                throw e
            })
        }).catch(e => {
            window.console.log(e)
            throw new Error('connect ledger failed, please reconnection ledger')
        })
    }

    _createMsgSwap(sender, req) {
        if (!req.recipient) {
            req.recipient = sender
        }
        return [{
            type: 'swap_order',
            value: {
                input: {
                    address: sender,
                    coin: req.input,
                },
                output: {
                    address: req.recipient,
                    coin: req.output,
                },
                deadline: new Date().getTime(),
                isBuyOrder: req.isBuyOrder
            }
        }]
    }

    _createAddLiquidityMsg(sender, req) {
        return [{
            type: 'add_liquidity',
            value: {
                max_token: req.maxToken,
                exact_standard_amt: req.exactIrisAmt,
                min_liquidity: req.minLiquidity,
                deadline: new Date().getTime(),
                sender: sender
            }
        }]
    }

    _createRemoveLiquidityMsg(sender, req) {
        return [{
            type: 'remove_liquidity',
            value: {
                withdraw_liquidity: req.withdrawLiquidity,
                min_token: req.minToken,
                min_standard_amt: req.minIrisAmt,
                deadline: new Date().getTime(),
                sender: sender
            }
        }]
    }
}

export class Token {
    static getUniDenom(tokenId) {
        return `uni:${tokenId}`
    }

    static getMainDenom(denom) {
        if (denom === 'uni:iris') {
            return 'IRIS'
        }
        let domain = denom.replace('uni:', '')
        return domain.toUpperCase()
    }

    static minTokenToUniDenom(denom) {
        if (denom === 'uiris') {
            return 'uni:iris'
        }
        let domain = denom.substr(1)
        return `uni:${domain}`
    }

    static uniDenomToMinDenom(denom) {
        if (denom === 'uni:iris') {
            return 'uiris'
        }
        let domain = denom.replace('uni:', '')
        return `u${domain}`
    }

    static toFix(amount) {
        return Number(amount).toFixed(10)
    }
}
