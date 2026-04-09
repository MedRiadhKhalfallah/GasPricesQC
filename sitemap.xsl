<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
<xsl:output method="html" encoding="UTF-8" indent="yes" />
<xsl:template match="/">
<html lang="fr-CA">
<head>
  <title>Plan du site — Prix d'essence Québec</title>
  <meta name="robots" content="noindex, follow" />
  <style>
    body { font-family: "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #f8f9fa; color: #333; }
    h1 { color: #0033A0; font-size: 1.5rem; border-bottom: 3px solid #0033A0; padding-bottom: .5rem; }
    p { color: #666; font-size: .9rem; }
    a { color: #0033A0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    th { background: #0033A0; color: #fff; text-align: left; padding: .75rem 1rem; font-size: .85rem; }
    td { padding: .6rem 1rem; border-bottom: 1px solid #eee; font-size: .85rem; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f0f4ff; }
    .back { display: inline-block; margin-top: 1.5rem; background: #0033A0; color: #fff; padding: .5rem 1.5rem; border-radius: 4px; text-decoration: none; }
    .back:hover { background: #002277; color: #fff; text-decoration: none; }
  </style>
</head>
<body>
  <h1>⛽ Plan du site — Prix d'essence Québec</h1>
  <p>Ce fichier sitemap XML est utilisé par les moteurs de recherche (Google, Bing) pour indexer les pages du site. Voici la liste des pages disponibles :</p>
  <table>
    <thead>
      <tr>
        <th>Page</th>
        <th>Dernière modification</th>
        <th>Fréquence</th>
        <th>Priorité</th>
      </tr>
    </thead>
    <tbody>
      <xsl:for-each select="sitemap:urlset/sitemap:url">
        <tr>
          <td><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc" /></a></td>
          <td><xsl:value-of select="sitemap:lastmod" /></td>
          <td><xsl:value-of select="sitemap:changefreq" /></td>
          <td><xsl:value-of select="sitemap:priority" /></td>
        </tr>
      </xsl:for-each>
    </tbody>
  </table>
  <a href="/" class="back">← Retour à l'accueil</a>
</body>
</html>
</xsl:template>
</xsl:stylesheet>

