# Alignement avec la page Tool du site principal

Ce document décrit comment **nexus-private-dapp** se comporte exactement comme la page **/tool** du site Nexus (wallet en haut à droite, requêtes, validation, paiement).

---

## Comportement identique à /tool

- **Page d’accueil** : la page à la racine (`/`) du private dApp est **la même** que `src/app/tool/page.tsx` du site principal (copie à l’identique).
- **Wallet en haut à droite** : la barre **DappNav** (équivalent de la Navbar du site principal) affiche le bouton **Connect Wallet** en haut à droite et écoute l’événement `nexus-connect-wallet`.
- **Flux requête** : Saisie → **Validate** → si pas de wallet : envoi de `nexus-connect-wallet` → DappNav ouvre le sélecteur de wallet → après connexion, l’utilisateur peut relancer **Validate** → paiement x402 (si configuré) → envoi de la requête vers `/api/chat`.

---

## Changements effectués

1. **Remplacement de la page**  
   - **Avant** : `nexus-private-dapp/src/app/page.tsx` était une version simplifiée (style Agent, sans carousel Dashboard/Mixer).  
   - **Après** : contenu **identique** à `src/app/tool/page.tsx` du site principal (même composant, même états, carousel Agent / Dashboard / Mixer, boutons wallet dans la page, `submitMessage`, modale de paiement x402, etc.).

2. **Assets wallet**  
   - **Ajout** : copie de `public/wallet/*` (metamask.png, rabby.png, walletconnect.png, coinbase.webp) du site principal vers `nexus-private-dapp/public/wallet/` pour que les boutons MetaMask / Rabby / WalletConnect / Coinbase s’affichent correctement.

3. **Aucun changement** sur :  
   - **Layout** (`src/app/layout.tsx`) : déjà avec DappNav + Suspense.  
   - **DappNav** : écoutait déjà `nexus-connect-wallet` et appelle `handleConnectWallet()` (même logique que la Navbar du site principal).  
   - **Composants et libs** : déjà présents (execution, x402, walletProviderStore, mixerWallet, etc.).

---

## Résumé du flux (identique au site /tool)

1. L’utilisateur ouvre le private dApp (ex. `http://localhost:3001/`).
2. Il voit la même interface que sur `/tool` (Agent, Dashboard, Mixer en carousel).
3. Il peut connecter le wallet soit :
   - en cliquant sur **Connect Wallet** en haut à droite (DappNav),  
   - soit en cliquant sur un des boutons wallet dans la zone Agent (MetaMask, Rabby, etc.).
4. S’il envoie une requête sans être connecté : la page envoie `nexus-connect-wallet` → DappNav ouvre le sélecteur → message « Connect your wallet first, then validate again ».
5. Après connexion, **Validate** déclenche le même flux que sur /tool : paiement (si x402 activé), puis appel à `/api/chat` et affichage de la réponse.

---

## Paiement : modale et transaction

Pour que la **modale de paiement** et la **transaction** (ouverture du wallet, 0,05 USDC) s’affichent quand tu cliques sur **Validate** puis **Pay**, il faut définir dans **`nexus-private-dapp/.env.local`** :

```env
PAY_TO=0xVOTRE_ADRESSE_ETH_SUR_BASE
```

Optionnel : `X402_MODE=txhash`, `BASE_RPC_URL=https://mainnet.base.org`.

Le dossier **facilitator-local** (à la racine du repo principal) **n’a rien à voir** avec le Nexus Beta : il n’est pas dans ce projet et n’est pas requis. Le flux utilisé ici est le mode **txHash** (vérification on-chain), pas le facilitator.

---

## Lancer le private dApp

```bash
cd nexus-private-dapp
# Créer .env.local avec au minimum PAY_TO=0x... pour que la modale + transaction s'affichent
npm install
npm run dev
```

Ouvrir **http://localhost:3001**. Le wallet en haut à droite et le flux requête/paiement sont les mêmes que sur la page **/tool** du site principal.
