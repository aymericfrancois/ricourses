// Génération et téléchargement de CSV compatibles Excel FR (séparateur ";",
// décimales avec virgule, BOM UTF-8 pour les accents).

function champCsv(val) {
  if (val == null) return ''
  const s = String(val)
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function formatNombreCsv(n, decimales = 2) {
  if (n == null) return ''
  return Number(n).toFixed(decimales).replace('.', ',')
}

// lignes : tableau de tableaux, 1re ligne = en-têtes.
export function construireCsv(lignes) {
  return lignes.map(ligne => ligne.map(champCsv).join(';')).join('\r\n')
}

export function telechargerCsv(nomFichier, contenu) {
  const blob = new Blob(['\uFEFF' + contenu], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
