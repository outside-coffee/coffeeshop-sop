import { parseSalesFile, summarizeSales } from './importSales'
import { TextDecoder, TextEncoder } from 'util'

global.TextDecoder = TextDecoder
const xml = (date = '18/11/2026', price = '5') => `<DocumentElement><Table><Numero_Ticket>12</Numero_Ticket><Caissier>Équipe</Caissier><Heure>09:15:02</Heure><Date>${date}</Date><Produit>Café</Produit><Qte>2</Qte><Prix_Unitaire>${price}</Prix_Unitaire><Total_TTC>10</Total_TTC><Caisse>A</Caisse><Numtable>1</Numtable></Table></DocumentElement>`
const file = (text, buffer) => ({ name: 'sales.xml', size: text.length, arrayBuffer: async () => buffer || new TextEncoder().encode(text).buffer })

test('lit le ticket et calcule le résumé', async () => {
  const { rows } = await parseSalesFile(file(xml()))
  expect(rows[0].id_ticket_compact).toBe('1220261118091502')
  expect(rows[0].produit).toBe('Café')
  expect(summarizeSales(rows)[0]).toMatchObject({ tickets: 1, articles: 2, ca: 10 })
})
test('accepte CP1252 malgré une déclaration UTF-8', async () => {
  const text = '<?xml version="1.0" encoding="UTF-8"?>' + xml()
  const buffer = Uint8Array.from(Array.from(text).map(c => c.charCodeAt(0))).buffer
  expect((await parseSalesFile(file(text, buffer))).rows[0].produit).toBe('Café')
})
test('rejette les dates impossibles et XML malformés', async () => {
  await expect(parseSalesFile(file(xml('31/02/2026')))).rejects.toThrow('date invalide')
  await expect(parseSalesFile(file('<broken>'))).rejects.toThrow('XML est invalide')
})
test('exclut les prix nuls', async () => {
  expect(await parseSalesFile(file(xml('18/11/2026', '0')))).toEqual({ rows: [], excluded: 1 })
})
