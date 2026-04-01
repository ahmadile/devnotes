# Guide de Déploiement : DevNotes 🚀

Ton application est prête pour le monde réel ! Voici comment la déployer gratuitement en utilisant **GitHub** et **Vercel** (recommandé pour les projets React/Vite).

## 1. Préparer ton projet sur GitHub

1.  **Crée un compte GitHub** si tu n'en as pas.
2.  **Crée un nouveau dépôt** (repository) nommé `devnotes`.
3.  **Pousse ton code** vers GitHub :
    ```bash
    git init
    git add .
    git commit -m "Initial commit - Zinc Indigo Redesign"
    git branch -M main
    git remote add origin https://github.com/TON_NOM_UTILISATEUR/devnotes.git
    git push -u origin main
    ```

## 2. Déployer sur Vercel (Gratuit)

L'avantage de Vercel est qu'il détecte automatiquement ton projet Vite.

1.  Rends-toi sur [Vercel.com](https://vercel.com) et connecte-toi avec ton compte GitHub.
2.  Clique sur **"Add New"** > **"Project"**.
3.  Importe ton dépôt `devnotes`.
4.  **IMPORTANT : Configurer les Variables d'Environnement**
    Avant de cliquer sur "Deploy", va dans la section **Environment Variables** et ajoute :
    -   `VITE_CLERK_PUBLISHABLE_KEY` : (Ta clé pk_test_... de `.env.local`)
    -   `CLERK_SECRET_KEY` : (Ta clé sk_test_... de `.env.local`)
    -   `MONGODB_URI` : (Ton lien de connexion MongoDB)
    -   `MONGODB_DB` : `devnotes`
5.  Clique sur **"Deploy"**.

## 3. Configurer Clerk pour la Production

Une fois ton application déployée, tu auras une URL type `https://devnotes-xxx.vercel.app`.

1.  Va sur ton [Tableau de bord Clerk](https://dashboard.clerk.com).
2.  Dans **Paths**, mets à jour l'URL de ton site (si tu passes en mode production "Pro"). 
3.  *Note : Pour le mode test, tu peux ajouter ton URL Vercel dans les "Authorized Origins" si nécessaire.*

## 4. Pourquoi GitHub ?

-   **Sauvegarde** : Ton code est en sécurité sur le cloud.
-   **CI/CD** : Chaque fois que tu fais une modification et que tu `git push`, ton site est mis à jour automatiquement sur Vercel.
-   **Portfolio** : Tu peux montrer ton code à d'autres développeurs.

---

> [!TIP]
> **Tu veux une autre option ?**
> Netlify et Cloudflare Pages sont aussi d'excellentes alternatives gratuites qui fonctionnent de la même manière que Vercel.
