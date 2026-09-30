// Extra Accounting 9706 questions (AS), in the style of Paper 1 and Paper 2.
(function () {
  const S = 'acc';
  const M = (topic, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: [1] });
  const GEN = (topic, make, papers) => Bank.add(S, { gen: true, topic, make, papers: papers || [1, 2] });
  const { rnd, pick, money: $, r2 } = Bank;
  const tbl = (head, rows) => `<table class="qt"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  M('a1', 'Which source of finance does NOT have to be repaid?',
    ['Ordinary share capital', 'Bank loan', 'Debentures', 'Bank overdraft'], 0,
    'Share capital is permanent finance; shareholders are owners, not lenders.');
  M('a1', 'Which is a disadvantage of a bank overdraft?',
    ['It can be withdrawn by the bank at short notice', 'It is long-term finance', 'Interest is only charged on the full limit', 'It dilutes ownership'], 0,
    'Overdrafts are flexible short-term finance but repayable on demand and often expensive.');
  M('a1', 'Which document governs the relationship between partners?',
    ['The partnership agreement (deed)', 'The articles of association', 'The trial balance', 'The prospectus'], 0,
    'Articles of association apply to companies. Without a partnership agreement, statutory rules apply.');

  M('a2', 'Which book of prime entry records returns of goods from customers?',
    ['Sales returns journal (returns inwards journal)', 'Purchases returns journal', 'Cash book', 'The journal'], 0,
    'Returns inwards are goods customers send back.');
  M('a2', 'A cheque received from a customer is dishonoured. What is the entry?',
    ['Debit trade receivable, credit bank', 'Debit bank, credit trade receivable', 'Debit irrecoverable debts, credit bank', 'Debit bank, credit sales'], 0,
    'The customer owes the money again and the bank balance falls.');
  M('a2', 'Rent received from a sub-tenant is recorded as',
    ['a credit in rent received (income)', 'a debit in rent received', 'a credit in capital', 'a debit in rent payable'], 0,
    'Income accounts are credited when income is earned.');
  M('a2', 'A business buys machinery for cash. What is the effect on the accounting equation?',
    ['One asset increases and another asset decreases', 'Assets and capital increase', 'Assets and liabilities increase', 'Assets decrease and liabilities decrease'], 0,
    'Machinery up, bank/cash down: total assets unchanged.');
  M('a2', 'Which is the purpose of a trial balance?',
    ['To check the arithmetical accuracy of the double entry', 'To show profit for the year', 'To show the financial position', 'To detect all errors'], 0,
    'It will not reveal errors that do not affect the totals.');

  M('a3', 'The sale of an old machine was credited to sales. Which type of error is this?',
    ['Error of principle', 'Error of commission', 'Error of omission', 'Transposition error'], 0,
    'A capital receipt was treated as revenue: the wrong class of account.');
  M('a3', 'An invoice for $87 was entered in both accounts as $78. This is an error of',
    ['original entry', 'transposition affecting the trial balance', 'principle', 'reversal'], 0,
    'The wrong figure was used on both sides, so the trial balance still agrees.');
  M('a3', 'A suspense account has a credit balance of $150. The only error: a credit sale of $150 was correctly debited to the customer but not posted to the sales account. What is the correcting entry?',
    ['Debit suspense $150, credit sales $150', 'Debit sales $150, credit suspense $150', 'Debit trade receivables $150, credit suspense $150', 'No entry needed'], 0,
    'The missing credit made the debit side $150 larger, so suspense was opened with a $150 credit. Crediting sales and debiting suspense clears it.');
  M('a3', 'Wages of $400 were debited to the wages account as $4 000. What is the effect on profit?',
    ['Profit is understated by $3 600', 'Profit is overstated by $3 600', 'Profit is understated by $4 000', 'No effect'], 0,
    'Expenses were overstated by $3 600, so profit is understated by the same amount.');

  M('a4', 'Which concept means that a transaction too small to matter need not be treated strictly (e.g. a stapler is treated as an expense)?',
    ['Materiality', 'Prudence', 'Consistency', 'Duality'], 0,
    'Immaterial items can be expensed for simplicity.');
  M('a4', 'Only items that can be measured in money are recorded in the accounts. This is the',
    ['money measurement concept', 'historical cost concept', 'realisation concept', 'going concern concept'], 0,
    'Staff skills and morale are therefore not recorded.');
  M('a4', 'Assets are normally recorded at what they cost. This is the',
    ['historical cost concept', 'prudence concept', 'going concern concept', 'materiality concept'], 0,
    'Historical cost is objective and verifiable, though it may not reflect current values.');
  M('a4', 'Every transaction has two aspects, a debit and a credit. This is the',
    ['duality concept', 'business entity concept', 'accruals concept', 'realisation concept'], 0,
    'It is the basis of double-entry bookkeeping.');

  M('a5', 'Why is depreciation charged?',
    ['To match the cost of the asset with the periods that benefit from it', 'To save cash for a replacement', 'To show the market value of assets', 'To reduce tax paid'], 0,
    'Accruals (matching): the cost is spread over the asset\'s useful life. It is not a cash fund.');
  M('a5', 'Which is a cause of depreciation?',
    ['Wear and tear', 'Inflation', 'Revaluation', 'Appreciation'], 0,
    'Causes include wear and tear, obsolescence, passage of time and depletion.');
  M('a5', 'Which is the double entry for the annual depreciation charge?',
    ['Debit depreciation expense, credit provision for depreciation', 'Debit asset, credit depreciation', 'Debit provision for depreciation, credit bank', 'Debit bank, credit depreciation'], 0,
    'Accumulated depreciation is built up in the provision account, which is shown as a deduction from cost.');

  M('a6', 'Rent receivable of $500 is owing to the business at the year end. How is it shown?',
    ['As a current asset (other receivable)', 'As a current liability', 'Deducted from rent received', 'Not shown'], 0,
    'Income earned but not yet received is an accrued income: an asset.');
  M('a6', 'Insurance of $1 200 was paid on 1 October for the year to 30 September next year. The year end is 31 December. What is the prepayment?',
    ['$900', '$300', '$1 200', '$0'], 0,
    'Only 3 months (Oct–Dec) belong to this year: $300. The remaining 9 months, $900, are prepaid.');
  M('a6', 'A debt previously written off is recovered. What is the entry for the cash received (ignoring reinstating the debt)?',
    ['Debit bank, credit irrecoverable debts recovered (income)', 'Debit irrecoverable debts, credit bank', 'Debit bank, credit sales', 'Debit trade receivables, credit bank'], 0,
    'The recovery is income in the year it is received.');

  M('a7', 'Which cost should NOT be included in the cost of inventory?',
    ['Selling and distribution costs', 'Purchase price', 'Carriage inwards', 'Costs of conversion'], 0,
    'IAS 2: cost includes purchase and conversion costs to bring inventory to its present location and condition, but not selling costs.');
  M('a7', 'If closing inventory is overstated by $2 000, what is the effect on profit for the year?',
    ['Profit is overstated by $2 000', 'Profit is understated by $2 000', 'No effect', 'Profit is overstated by $4 000'], 0,
    'Higher closing inventory reduces cost of sales, increasing gross profit and profit.');

  M('a8', 'A cheque paid in to the bank has not yet appeared on the bank statement. It is',
    ['an outstanding lodgement (deposit)', 'an unpresented cheque', 'a dishonoured cheque', 'a standing order'], 0,
    'When reconciling from the bank statement balance, outstanding lodgements are added.');
  M('a8', 'Which item requires an entry in the cash book when preparing a bank reconciliation?',
    ['A direct debit shown only on the bank statement', 'An unpresented cheque', 'An outstanding lodgement', 'A bank error'], 0,
    'Items the business did not know about (direct debits, charges, credit transfers, dishonoured cheques) are entered in the cash book.');

  M('a9', 'Which item appears on the debit side of the purchases ledger control account?',
    ['Payments to suppliers', 'Credit purchases', 'Opening credit balance', 'Interest charged by suppliers'], 0,
    'Payments, discounts received, returns outwards and contras reduce trade payables (debits).');
  M('a9', 'A credit balance on a sales ledger control account most likely arises because',
    ['a customer has overpaid', 'a customer owes money', 'goods were sold for cash', 'a debt was written off'], 0,
    'Overpayments or returns after payment leave a credit balance on the customer\'s account.');

  M('a11', 'Which is a revenue expense in the income statement?',
    ['Repairs to machinery', 'Purchase of a delivery van', 'Installation of new machinery', 'Legal fees for buying premises'], 0,
    'Repairs maintain the asset; the others are capital expenditure.');
  M('a11', 'Discount received is treated as',
    ['income, added to gross profit', 'an expense', 'part of cost of sales', 'a current liability'], 0,
    'Discounts received reduce the amount paid for purchases and are shown as other income.');
  M('a11', `Revenue $120 000, cost of sales $78 000, expenses $30 000. What is the profit for the year?`,
    ['$12 000', '$42 000', '$48 000', '$90 000'], 0,
    'Gross profit = 120 000 - 78 000 = 42 000. Profit = 42 000 - 30 000 = 12 000.');

  M('a12', 'A partner\'s current account has a debit balance. This means',
    ['the partner has drawn more than their share of profits and other credits', 'the partner has lent money to the business', 'the partnership owes the partner money', 'the partner has introduced capital'], 0,
    'Drawings and interest on drawings exceed the partner\'s share of profit, salary and interest on capital.');
  M('a12', 'Why might partners keep fixed capital accounts with separate current accounts?',
    ['So that the capital invested is kept separate from profit shares and drawings', 'Because it is required by law', 'To avoid paying interest', 'To hide drawings'], 0,
    'It shows clearly the permanent capital each partner has invested.');
  M('a12', 'Interest on a partner\'s loan to the partnership is',
    ['an expense in the income statement', 'an appropriation of profit', 'debited to the partner\'s current account', 'a capital reserve'], 0,
    'It is a charge against profit because the partner is acting as a lender.');

  M('a13', 'Which item is shown under current liabilities of a limited company?',
    ['Trade payables', 'Debentures repayable in ten years', 'Share premium', 'Retained earnings'], 0,
    'Debentures are non-current liabilities unless repayable within 12 months.');
  M('a13', 'A rights issue is',
    ['an offer of new shares to existing shareholders, usually at a discount to market price', 'free shares from reserves', 'a loan to the company', 'a dividend payment'], 0,
    'It raises cash from existing shareholders in proportion to their holdings.');
  M('a13', 'Which reserve is created when non-current assets are revalued upwards?',
    ['Revaluation reserve', 'General reserve', 'Retained earnings', 'Share premium'], 0,
    'It is a capital reserve and cannot be distributed as a cash dividend.');

  M('a14', 'A trader\'s gross margin is 40%. Revenue is $50 000. What is cost of sales?',
    ['$30 000', '$20 000', '$35 714', '$70 000'], 0,
    'Gross profit = 40% × 50 000 = 20 000. Cost of sales = 50 000 - 20 000 = 30 000.');
  M('a14', 'In incomplete records, credit sales can be found using',
    ['a trade receivables control account (total account)', 'a bank reconciliation', 'an appropriation account', 'a disposal account'], 0,
    'Credit sales = closing receivables + receipts from customers + discounts etc. - opening receivables.');

  M('a15', 'A business has a current ratio of 3.5:1. What might this indicate?',
    ['Too much money tied up in current assets such as inventory or cash', 'The business cannot pay its debts', 'High profitability', 'Low gearing'], 0,
    'Very high liquidity may mean resources are idle and could be used more profitably.');
  M('a15', 'Gross margin falls while revenue rises. A likely reason is',
    ['the business cut selling prices to boost sales', 'expenses increased', 'more depreciation was charged', 'drawings increased'], 0,
    'Lower prices or higher purchase costs reduce gross profit per $ of revenue.');
  M('a15', 'Inventory turnover (days) increases from 30 to 55 days. This suggests',
    ['inventory is selling more slowly', 'inventory is selling faster', 'liquidity has improved', 'customers pay faster'], 0,
    'More days to sell inventory may mean falling demand or overstocking.');

  M('a16', 'An advantage of paying workers a time rate is that',
    ['quality is less likely to suffer from rushing', 'it encourages maximum output', 'costs per unit always fall', 'no supervision is needed'], 0,
    'Time rates are simple and protect quality but give no direct incentive to work faster.');
  M('a16', 'When prices are rising, which method gives the lowest cost of materials issued?',
    ['FIFO', 'AVCO', 'Both are equal', 'It depends on sales'], 0,
    'FIFO charges the oldest, cheaper prices to production first.');

  M('a17', 'Overheads are shared between cost centres on a fair basis. Which basis suits rent?',
    ['Floor area', 'Number of employees', 'Machine hours', 'Value of machinery'], 0,
    'Rent relates to space occupied.');
  M('a17', 'Why do businesses use a predetermined overhead absorption rate?',
    ['Actual overheads are not known until the end of the period, but costs are needed for pricing now', 'It is always accurate', 'It avoids all under-absorption', 'It is required for sole traders'], 0,
    'Budgeted figures allow products to be costed during the period.');
  M('a17', 'Which is a semi-variable cost?',
    ['A phone bill with a fixed line rental plus a charge per call', 'Factory rent', 'Direct materials', 'The managing director\'s salary'], 0,
    'Semi-variable costs have fixed and variable elements.');

  GEN('a15', () => {
    const cos = rnd(60, 200) * 1000, oi = rnd(5, 20) * 1000, ci = rnd(5, 20) * 1000;
    const avg = (oi + ci) / 2, days = r2(avg / cos * 365);
    return { type: 'num', q: `Opening inventory ${$(oi)}, closing inventory ${$(ci)}, cost of sales ${$(cos)}. Calculate inventory turnover in days using average inventory (2 d.p.).`,
      answer: days, tol: 0.1, explain: `Average inventory = (${oi} + ${ci}) ÷ 2 = ${$(avg)}. Days = ${avg} ÷ ${cos} × 365 = ${days} days.` };
  });
  GEN('a15', () => {
    const rev = rnd(100, 500) * 1000, pfy = Math.round(rev * rnd(5, 20) / 100 / 1000) * 1000;
    const pm = r2(pfy / rev * 100);
    return { type: 'num', q: `Revenue ${$(rev)}; profit for the year ${$(pfy)}. Calculate the profit margin (%, 2 d.p.).`,
      answer: pm, tol: 0.02, explain: `Profit margin = profit for the year ÷ revenue × 100 = ${pm}%.` };
  });
  GEN('a15', () => {
    const cp = rnd(80, 300) * 1000, tp = rnd(8, 50) * 1000;
    const days = r2(tp / cp * 365);
    return { type: 'num', q: `Credit purchases ${$(cp)}; trade payables at the year end ${$(tp)}. Calculate trade payables turnover in days (2 d.p.).`,
      answer: days, tol: 0.1, explain: `${tp} ÷ ${cp} × 365 = ${days} days.` };
  });
  GEN('a6', () => {
    const annual = rnd(12, 48) * 100, m = pick([3, 4, 6, 8, 9]);
    const pre = annual * m / 12;
    return { type: 'num', q: `A year's insurance of ${$(annual)} was paid in advance. At the year end, ${m} months of it relate to next year. What is the prepayment ($)?`,
      answer: pre, tol: 0.5, explain: `${m}/12 × ${$(annual)} = ${$(pre)}, shown as a current asset.` };
  });
  GEN('a13', () => {
    const n = rnd(1, 10) * 10000, nom = pick([0.5, 1]), iss = nom + pick([0.25, 0.5, 0.75, 1]);
    const prem = n * (iss - nom);
    return { type: 'num', q: `A company issues ${n.toLocaleString()} ordinary shares of $${nom.toFixed(2)} each at $${iss.toFixed(2)} per share, fully paid. By how much does the share premium account increase ($)?`,
      answer: prem, tol: 0.5, explain: `Premium per share = $${(iss - nom).toFixed(2)}. × ${n.toLocaleString()} = ${$(prem)}. Share capital rises by ${$(n * nom)}.` };
  });
  GEN('a13', () => {
    const shares = rnd(10, 80) * 10000, dps = pick([0.05, 0.08, 0.1, 0.12, 0.15]);
    const div = r2(shares * dps);
    return { type: 'num', q: `A company has ${shares.toLocaleString()} ordinary shares and pays a dividend of $${dps.toFixed(2)} per share. What is the total dividend ($)?`,
      answer: div, tol: 0.5, explain: `${shares.toLocaleString()} × $${dps.toFixed(2)} = ${$(div)}, shown in the statement of changes in equity.` };
  });
  GEN('a12', () => {
    const dr = rnd(10, 30) * 1000, rate = pick([2, 3, 5]);
    const iod = dr * rate / 100 / 2;
    return { type: 'num', q: `A partner withdrew ${$(dr)} evenly during the year (assume the average drawing was outstanding for 6 months). Interest on drawings is charged at ${rate}% per year. Calculate interest on drawings ($).`,
      answer: iod, tol: 0.5, explain: `${rate}% × ${$(dr)} × 6/12 = ${$(iod)}. It is added to the profit available for appropriation.` };
  });
})();
