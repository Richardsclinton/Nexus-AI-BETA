# Requête, wallet, paiement et lancement — où se trouve la logique

Ce document indique où sont implémentées les infos et la logique pour **faire une requête**, **ouvrir le wallet**, **paiement x402** et **lancer la requête** dans la private dApp (et son équivalent archive).

---

## 1. Page du tool (UI + enchaînement)

| Emplacement | Fichier |
|-------------|---------|
| **Archive** | `src/internal-archive/enter-tool/page.tsx` (site principal) |
| **Private dApp** | `nexus-private-dapp/src/app/page.tsx` |

Dans cette page :

- **Lancer une requête**  
  Fonction **`submitMessage`** (env. ligne ~891) — envoi du message, choix texte / image / trailer.

- **« Connect wallet first »**  
  Si pas de wallet connecté : envoi de l’événement **`nexus-connect-wallet`** et message d’erreur (env. ~906). La nav (DappNav) écoute cet événement et ouvre le flux de connexion wallet.

- **Paiement puis requête**  
  Fonction qui utilise **`createPaidFetchFromConnectedWallet()`** puis **`paidFetch("/api/chat", { ... })`** (env. ~1317–1325) — c’est là que la requête est vraiment envoyée après paiement.

- **Ouverture du wallet**  
  Plus bas dans la page, logique qui réagit à **`nexus-connect-wallet`** et qui récupère le provider (env. ~1419). Dans la private dApp, le bouton « Connect Wallet » et le picker sont dans **DappNav** ; la page utilise le même store (`walletProviderStore`) pour le provider.

---

## 2. Wallet : connexion et état

| Rôle | Fichier |
|------|---------|
| **Store / persistance** | `src/lib/walletProviderStore.ts` |
| **Vérifier que le wallet est prêt pour payer** | `src/lib/x402/txHashWalletPayment.ts` |

- **`walletProviderStore.ts`**  
  - `getSelectedProvider`, `rehydrateProvider`, `setSelectedProvider` — quel wallet est choisi, rechargé au refresh.  
  - `getLastWalletKey`, `setLastWalletKey`, `clearWalletConnection` — persistance du choix (MetaMask, Rabby, default).

- **`txHashWalletPayment.ts`**  
  - **`getWalletReadiness(provider)`** (env. ligne ~46) — indique si le wallet peut signer / payer.  
  - **`sendUsdcTransferAndGetTxHash(...)`** (env. ligne ~97) — envoi USDC et récupération du tx hash pour le paiement.

---

## 3. Paiement x402 (côté client)

| Rôle | Fichier |
|------|---------|
| **Création du fetch qui paie puis envoie la requête** | `src/lib/x402/browserPaidFetch.ts` |
| **Stockage « paiement en attente »** (ex. après reload) | `src/lib/x402/pendingPaymentStorage.ts` |

- **`browserPaidFetch.ts`**  
  - **`createPaidFetchFromConnectedWallet()`** (env. ligne ~218) — construit le fetch qui gère le flux x402 (payment required → payer → renvoyer la requête).  
  - **`createPaidFetchFromProvider(provider)`** (env. ligne ~86) — version à partir d’un provider déjà connu.

- **`pendingPaymentStorage.ts`**  
  - `savePendingPayment`, `getPendingPayment`, `clearPendingPayment` — pour reprendre un paiement après rechargement ou fermeture de fenêtre.

---

## 4. Côté API (vérification paiement, puis LLM)

| Rôle | Fichier |
|------|---------|
| **Route qui reçoit la requête et exige le paiement** | `src/app/api/chat/route.ts` |
| **Vérification x402 côté serveur** | `src/lib/x402/server.ts` |

- **`api/chat/route.ts`**  
  Utilise **`enforceX402Payment`** (depuis `src/lib/x402/server.ts`) pour vérifier le paiement, puis appelle le gateway LLM (texte / image / vidéo).

---

## Résumé

| Besoin | Où regarder |
|--------|--------------|
| **Quand je veux faire une requête / lancer la requête** | Page du tool : `submitMessage` et le bloc qui fait `createPaidFetchFromConnectedWallet()` puis `paidFetch("/api/chat", ...)`. |
| **Ouverture / choix du wallet** | `walletProviderStore.ts` + dans la page / DappNav la réaction à **`nexus-connect-wallet`**. |
| **Paiement (x402, USDC, tx hash)** | `browserPaidFetch.ts`, `txHashWalletPayment.ts`, `pendingPaymentStorage.ts` ; côté serveur : `api/chat/route.ts` + `lib/x402/server.ts`. |

Les numéros de lignes sont approximatifs et peuvent varier après refactors.
