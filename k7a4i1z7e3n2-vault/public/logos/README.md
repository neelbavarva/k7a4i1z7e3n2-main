# Bank logos

Cleaned copies of public logo files, one JSON per bank id (see `BANKS` in `lib/cards.js`).
They are loaded by `components/k7/BankLogo.js` only when a bank is on screen, from this site;
nothing is requested from a third party. Each logo stays its bank's trademark and is used
here only to label the owner's own cards.

Cleaning: every shape flattened into one coordinate space, colours turned into CSS variables
(`--li` ink, `--ld` dark ink such as navy or black lettering, `--lk` cut-outs, `--lb` background
box) so one markup draws the full-colour logo (bank tiles), the card version with dark lettering
turned white (`is-lift`), or an all-white one (`is-mono`). Geometry only: no scripts, styles,
text or images.

## Sources

Simple Icons (CC0-1.0, https://simpleicons.org, v16.33.0): amex (americanexpress), deutsche
(deutschebank), barclays, jio, and the ICICI symbol. Network marks in `components/k7/NetworkMark.js`:
visa, americanexpress, dinersclub, discover, jcb from Simple Icons; RuPay, Maestro, UnionPay, Mir,
Verve from Wikimedia Commons (RuPay.svg, Maestro 2016.svg, UnionPay logo.svg, Mir-logo.SVG.svg,
Verve Logo 2024.svg).

Wikipedia / Wikimedia Commons (upload.wikimedia.org):

- `hdfc`: HDFC Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg
- `sbi`: State Bank of India logo.svg — https://upload.wikimedia.org/wikipedia/en/5/58/State_Bank_of_India_logo.svg
- `iob`: Indian Overseas Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/f/fc/Indian_Overseas_Bank_Logo.svg
- `axis`: Axis Bank logo.svg — https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg
- `icici`: ICICI Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg
- `kotak`: Kotak Mahindra Bank logo.svg — https://upload.wikimedia.org/wikipedia/en/3/3b/Kotak_Mahindra_Bank_logo.svg
- `indusind`: IndusInd Bank SVG Logo.svg — https://upload.wikimedia.org/wikipedia/commons/4/40/IndusInd_Bank_SVG_Logo.svg
- `yes`: Yes Bank SVG Logo.svg — https://upload.wikimedia.org/wikipedia/commons/4/4f/Yes_Bank_SVG_Logo.svg
- `idfc`: Logo of IDFC First Bank.svg — https://upload.wikimedia.org/wikipedia/commons/3/3f/Logo_of_IDFC_First_Bank.svg
- `federal`: Federal bank.logo.svg — https://upload.wikimedia.org/wikipedia/commons/1/1c/Federal_bank.logo.svg
- `rbl`: RBL Bank SVG Logo.svg — https://upload.wikimedia.org/wikipedia/commons/7/70/RBL_Bank_SVG_Logo.svg
- `bandhan`: Bandhan Bank Svg Logo.svg — https://upload.wikimedia.org/wikipedia/commons/a/a0/Bandhan_Bank_Svg_Logo.svg
- `idbi`: IDBI Logo.svg — https://upload.wikimedia.org/wikipedia/en/4/41/IDBI_Logo.svg
- `sib`: South Indian Bank Logo.svg — https://upload.wikimedia.org/wikipedia/en/2/2f/South_Indian_Bank_Logo.svg
- `kvb`: Karur Vysya Bank.svg — https://upload.wikimedia.org/wikipedia/commons/9/92/Karur_Vysya_Bank.svg
- `cub`: City Union Bank.svg — https://upload.wikimedia.org/wikipedia/en/2/21/City_Union_Bank.svg
- `karnataka`: Karnataka Bank svg Logo.svg — https://upload.wikimedia.org/wikipedia/commons/5/55/Karnataka_Bank_svg_Logo.svg
- `dcb`: Development Credit Bank.svg — https://upload.wikimedia.org/wikipedia/commons/1/19/Development_Credit_Bank.svg
- `jk`: Jammu & Kashmir Bank Logo.svg — https://upload.wikimedia.org/wikipedia/en/1/12/Jammu_%26_Kashmir_Bank_Logo.svg
- `dhanlaxmi`: Dhanlaxmi Bank.svg — https://upload.wikimedia.org/wikipedia/en/4/46/Dhanlaxmi_Bank.svg
- `pnb`: Punjab National Bank new logo.svg — https://upload.wikimedia.org/wikipedia/commons/b/b2/Punjab_National_Bank_new_logo.svg
- `bob`: BankOfBarodaLogo.svg — https://upload.wikimedia.org/wikipedia/en/f/f2/BankOfBarodaLogo.svg
- `canara`: Canara Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/5/50/Canara_Bank_Logo.svg
- `union`: Union Bank of India Logo.svg — https://upload.wikimedia.org/wikipedia/commons/d/d0/Union_Bank_of_India_Logo.svg
- `sc`: Standard Chartered (2021).svg — https://upload.wikimedia.org/wikipedia/commons/0/0c/Standard_Chartered_%282021%29.svg
- `hsbc`: HSBC logo (2018).svg — https://upload.wikimedia.org/wikipedia/commons/a/aa/HSBC_logo_%282018%29.svg
- `citi`: Citi.svg — https://upload.wikimedia.org/wikipedia/commons/1/1b/Citi.svg
- `dbs`: DBS Bank Logo (alternative).svg — https://upload.wikimedia.org/wikipedia/en/b/b1/DBS_Bank_Logo_%28alternative%29.svg
- `airtel`: Airtel Payments Bank logo.svg — https://upload.wikimedia.org/wikipedia/commons/7/7c/Airtel_Payments_Bank_logo.svg

Banks without a usable logo file show their name set in type instead.
