# Politique de Sécurité et Maintenance

Maintenir une application sécurisée est un processus continu. Ce document décrit comment gérer les dépendances et effectuer des audits de sécurité pour **DevNotes**.

## 🛡️ Gestion des Dépendances

Pour prévenir les attaques sur la chaîne d'approvisionnement (*supply chain attacks*), toutes les dépendances dans `package.json` sont **fixées à des versions exactes**. Cela garantit que l'application n'exécute que du code qui a été vérifié.

### Mise à jour des Dépendances
Lorsque vous avez besoin de mettre à jour un paquet, n'utilisez pas de marqueurs de plage comme `^` ou `~`. À la place :

1.  Identifiez la version cible (ex: `npm info clerk-react versions`).
2.  Mettez à jour le numéro de version directement dans `package.json`.
3.  Exécutez `npm install`.
4.  Lancez l'audit de sécurité (voir ci-dessous).

## 🔍 Audits de Sécurité

Nous avons ajouté un script personnalisé pour simplifier les vérifications de sécurité.

### Audit de Routine
Exécutez régulièrement cette commande pour vérifier les vulnérabilités connues dans vos paquets installés :

```bash
npm run security-check
```

Cette commande lance `npm audit` avec un seuil de sévérité « Haut ». Si elle trouve des problèmes critiques, vous devez mettre à jour le paquet concerné immédiatement.

## 🧱 Content Security Policy (CSP)

DevNotes utilise **Helmet** pour appliquer une politique de sécurité du contenu (*Content Security Policy*). Cela protège l'application de :
- **XSS (Cross-Site Scripting)** : Empêcher l'exécution de scripts malveillants dans le navigateur.
- **Exfiltration de données non autorisée** : Garantir que les données ne sont envoyées qu'à des serveurs de confiance.

### Sources de Confiance
La politique est actuellement configurée pour autoriser :
- **Clerk** : Gestion de l'authentification et des utilisateurs.
- **Google Fonts** : Typographies Inter et JetBrains Mono.
- **Icônes Lucide** : Actifs SVG internes.

Si vous ajoutez un nouveau service externe (par exemple, un outil d'analyse ou un autre fournisseur de polices), vous devez mettre à jour les `directives` dans `server/index.ts` pour inclure le domaine du fournisseur.

## 🚨 Signalement de Vulnérabilités

Si vous découvrez une vulnérabilité de sécurité dans ce projet, veuillez ouvrir une "Issue" dans le dépôt ou contacter directement le responsable du projet.
