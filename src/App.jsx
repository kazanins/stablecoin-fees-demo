import { useEffect, useMemo, useState } from 'react'
import { createClient, http, parseUnits } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import { tempoModerato } from 'viem/chains'
import { Account, Actions, WebAuthnP256 } from 'viem/tempo'

const TOKENS = {
  pathUSD: '0x20c0000000000000000000000000000000000000',
  alphaUSD: '0x20c0000000000000000000000000000000000001',
  betaUSD: '0x20c0000000000000000000000000000000000002',
  thetaUSD: '0x20c0000000000000000000000000000000000003',
}

const RECIPIENT = '0x000000000000000000000000000000000000dEaD'
const DEFAULT_EXPLORER_BASE = `${tempoModerato.blockExplorers.default.url}/tx/`
const EXPLORER_TX_BASE = import.meta.env.VITE_TEMPO_EXPLORER_TX_BASE ?? DEFAULT_EXPLORER_BASE
const RPC_URL = import.meta.env.VITE_TEMPO_RPC_URL ?? 'https://rpc.moderato.tempo.xyz'

const STORAGE = {
  credential: 'tempo_demo_credential',
  session: 'tempo_demo_session',
}

function short(value) {
  if (!value) return ''
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatTransferError(error) {
  const raw = error?.shortMessage || error?.message || 'Unknown error'
  const normalized = String(raw)
  const lower = normalized.toLowerCase()

  let userMessage = 'Transfer failed. Please try again.'
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('too long')) {
    userMessage = 'Transfer timed out. The network may be congested, please retry.'
  } else if (lower.includes('rejected') || lower.includes('cancelled')) {
    userMessage = 'Transaction was cancelled.'
  } else if (lower.includes('insufficient')) {
    userMessage = 'Insufficient balance for transfer or fees.'
  } else if (lower.includes('nonce')) {
    userMessage = 'Transaction nonce conflict. Please retry in a few seconds.'
  }

  return {
    userMessage,
    details: normalized.length > 700 ? `${normalized.slice(0, 700)}...` : normalized,
  }
}

function getStoredCredential() {
  const raw = localStorage.getItem(STORAGE.credential)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function makeClient(account) {
  return createClient({
    account,
    chain: tempoModerato,
    transport: http(RPC_URL),
  })
}

const publicClient = createClient({
  chain: tempoModerato,
  transport: http(RPC_URL),
})

function launchPageShake() {
  document.body.classList.remove('page-shake')
  // Force reflow so animation restarts on repeated success.
  void document.body.offsetWidth
  document.body.classList.add('page-shake')
  setTimeout(() => document.body.classList.remove('page-shake'), 450)
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [credential, setCredential] = useState(() => getStoredCredential())

  const [transferToken, setTransferToken] = useState('alphaUSD')
  const [feeMode, setFeeMode] = useState('native')
  const [status, setStatus] = useState('Please sign in to continue.')
  const [txHash, setTxHash] = useState(null)
  const [pendingHash, setPendingHash] = useState(null)
  const [txError, setTxError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE.session)
    const savedCredential = getStoredCredential()
    if (savedSession !== 'active' || !savedCredential) return

    const restoredAccount = Account.fromWebAuthnP256(
      {
        id: savedCredential.id,
        publicKey: savedCredential.publicKey,
      },
      { rpId: window.location.hostname },
    )

    setCredential(savedCredential)
    setAccount(restoredAccount)
    setStatus(`Restored session: ${short(restoredAccount.address)}`)
  }, [])

  const payload = useMemo(() => {
    if (!account) return null
    const base = {
      to: RECIPIENT,
      token: TOKENS[transferToken],
      amount: parseUnits('10', 6).toString(),
    }
    if (feeMode !== 'native') {
      base.feeToken = TOKENS[feeMode]
    }
    return base
  }, [account, transferToken, feeMode])

  async function signUp() {
    setBusy(true)
    setTxHash(null)
    try {
      setStatus('Creating passkey...')
      const created = await WebAuthnP256.createCredential({
        label: `tempo-fees-${Date.now()}`,
        rpId: window.location.hostname,
      })

      const nextCredential = { id: created.id, publicKey: created.publicKey }
      localStorage.setItem(STORAGE.credential, JSON.stringify(nextCredential))
      localStorage.setItem(STORAGE.session, 'active')

      const nextAccount = Account.fromWebAuthnP256(nextCredential, {
        rpId: window.location.hostname,
      })

      setCredential(nextCredential)
      setAccount(nextAccount)
      setStatus('Passkey created. Funding via faucet...')

      await Actions.faucet.fundSync(publicClient, { account: nextAccount.address })
      setStatus(`Signed up + funded: ${short(nextAccount.address)}`)
    } catch (error) {
      setStatus(`Sign-up failed: ${error?.message ?? 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  async function signIn() {
    const stored = getStoredCredential()
    if (!stored) {
      setStatus('No saved passkey account found. Sign up first.')
      return
    }

    setBusy(true)
    try {
      setStatus('Verifying passkey...')
      const got = await WebAuthnP256.getCredential({
        rpId: window.location.hostname,
        async getPublicKey() {
          return stored.publicKey
        },
      })

      const activeCredential = { id: got.id, publicKey: got.publicKey }
      const nextAccount = Account.fromWebAuthnP256(activeCredential, {
        rpId: window.location.hostname,
      })

      localStorage.setItem(STORAGE.session, 'active')
      localStorage.setItem(STORAGE.credential, JSON.stringify(activeCredential))
      setCredential(activeCredential)
      setAccount(nextAccount)
      setStatus(`Logged in: ${short(nextAccount.address)}`)
    } catch (error) {
      setStatus(`Sign-in failed: ${error?.message ?? 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    localStorage.removeItem(STORAGE.session)
    setAccount(null)
    setTxHash(null)
    setStatus('Logged out. Sign in again to continue.')
  }

  async function copyAddress() {
    if (!account?.address) return
    try {
      await navigator.clipboard.writeText(account.address)
      setCopied(true)
      setStatus('Address copied to clipboard.')
      window.setTimeout(() => setCopied(false), 1300)
    } catch {
      setStatus('Copy failed. Clipboard permission blocked.')
    }
  }

  async function submit() {
    if (!account || !payload) return

    setBusy(true)
    setTxHash(null)
    setPendingHash(null)
    setTxError(null)
    setStatus('Submitting transfer...')

    try {
      const client = makeClient(account)
      const params = {
        to: payload.to,
        token: payload.token,
        amount: BigInt(payload.amount),
      }

      if (feeMode !== 'native') params.feeToken = TOKENS[feeMode]

      // Use async send to avoid frequent sync-RPC timeout failures.
      const hash = await Actions.token.transfer(client, params)
      setPendingHash(hash ?? null)
      setStatus('Transaction sent. Waiting for confirmation...')
      launchPageShake()

      try {
        const receipt = await waitForTransactionReceipt(publicClient, {
          hash,
          timeout: 120_000,
          pollingInterval: 1_000,
        })
        setTxHash(receipt?.transactionHash ?? hash)
        setPendingHash(null)
        setStatus('Transaction confirmed.')
      } catch (receiptError) {
        const details = String(receiptError?.message ?? '').toLowerCase()
        if (details.includes('timed out') || details.includes('timeout')) {
          setStatus('Transaction submitted. Confirmation is taking longer than expected.')
        } else {
          setStatus('Transaction submitted. Could not confirm yet, check explorer with tx hash.')
        }
      }
    } catch (error) {
      const formatted = formatTransferError(error)
      setStatus(formatted.userMessage)
      setTxError(formatted.details)
    } finally {
      setBusy(false)
    }
  }

  const signedIn = Boolean(account)

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Tempo Demo</p>
          <h1>Stablecoin Fees</h1>
        </div>

        {!signedIn ? (
          <div className="auth-controls">
            <button className="btn" onClick={signUp} disabled={busy}>
              Sign up
            </button>
            <button className="btn btn-ghost" onClick={signIn} disabled={busy}>
              Login
            </button>
          </div>
        ) : (
          <div className="auth-controls">
            <div className={`session-pill ${copied ? 'copied' : ''}`}>{short(account.address)}</div>
            <button
              className={`icon-btn ${copied ? 'copied' : ''}`}
              onClick={copyAddress}
              aria-label="Copy address"
              title="Copy address"
            >
              {copied ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="10" height="10" rx="2" ry="2" />
                  <path d="M5 15V7a2 2 0 0 1 2-2h8" />
                </svg>
              )}
            </button>
            <span className={`copy-toast ${copied ? 'show' : ''}`}>Copied</span>
            <button className="btn btn-logout" onClick={signOut}>
              Log out
            </button>
          </div>
        )}
      </header>

      <section className="callout">
        This demo shows that on Tempo, transaction fees can be paid in any stablecoin/token.
        If no fee token is selected, the fee defaults to the same stablecoin used for the transfer.
      </section>

      <main className="split">
        <section className="pane pane-left">
          <h2>Initiate Payment</h2>
          <p className="muted">Pick transfer token and fee strategy.</p>

          <label className="field">
            <span>Amount</span>
            <div className="amount-grid">
              {[
                { value: 'alphaUSD', label: '10 alphaUSD' },
                { value: 'betaUSD', label: '10 betaUSD' },
                { value: 'thetaUSD', label: '10 thetaUSD' },
              ].map((item) => (
                <button
                  key={item.value}
                  className={`amount-btn ${transferToken === item.value ? 'active' : ''}`}
                  onClick={() => {
                    setTransferToken(item.value)
                    setTxHash(null)
                    setPendingHash(null)
                    setTxError(null)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span>Fee payment token</span>
            <div className="fee-grid">
              {[
                { value: 'native', label: 'not specified' },
                { value: 'alphaUSD', label: 'alphaUSD' },
                { value: 'betaUSD', label: 'betaUSD' },
                { value: 'thetaUSD', label: 'thetaUSD' },
              ].map((item) => (
                <button
                  key={item.value}
                  className={`amount-btn ${feeMode === item.value ? 'active' : ''}`}
                  onClick={() => {
                    setFeeMode(item.value)
                    setTxHash(null)
                    setPendingHash(null)
                    setTxError(null)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </label>

          <button className="btn btn-primary" onClick={submit} disabled={!signedIn || busy}>
            Submit transaction
          </button>

          <div className="status">{status}</div>
        </section>

        <section className="pane pane-right">
          <h2>Call + Result</h2>
          <p className="muted">Payload shown here maps to `Actions.token.transfer` input.</p>
          <pre className="json-panel">
            {JSON.stringify(payload ?? { status: 'awaiting_input' }, null, 2)}
          </pre>
          <div className="result">
            {txHash ? (
              <>
                Success. Tx:{' '}
                <a href={`${EXPLORER_TX_BASE}${txHash}`} target="_blank" rel="noreferrer">
                  {txHash.slice(0, 12)}...{txHash.slice(-8)}
                </a>
              </>
            ) : null}
            {!txHash && pendingHash ? (
              <div>
                Pending Tx: {pendingHash.slice(0, 12)}...{pendingHash.slice(-8)}
              </div>
            ) : null}
            {txError ? (
              <div className="error-card">
                <strong>Transfer Error</strong>
                <p>{status}</p>
                <details>
                  <summary>Show technical details</summary>
                  <pre>{txError}</pre>
                </details>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}
