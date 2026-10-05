# Bank logos

One JSON per bank id (see `BANKS` in `lib/cards.js`), measured in `lib/logos.js`. They are
loaded by `components/k7/BankLogo.js` only when a bank is on screen, from this site; nothing is
requested from a third party. Each logo stays its bank's trademark and is used here only to label
the owner's own cards.

## How they were made

A one-off script cleaned every source file in a headless browser:

- every shape flattened into one coordinate space (groups, `<use>` and transforms resolved), with
  only geometry kept: no scripts, styles, text, images, links or ids;
- colours turned into CSS variables: `--li` ink, `--ld` dark ink (navy or black lettering),
  `--lk` cut-outs (a white or box-coloured shape over ink), `--lb` a background box. One markup
  draws the logo in its own colours (bank tiles), with dark lettering turned white (`is-lift`),
  or all white (`is-mono`);
- a detail drawn in another colour over a shape (Raiffeisen's cross on its yellow square, the oak
  in Swedbank's circle, the glyph in Punjab & Sind Bank's square) made a cut-out, so the white
  print keeps it;
- taglines and small print dropped ("Be a step ahead of life", "Smart way to bank", "A scheduled
  commercial bank", "established 1927", "Group", "Grupo Financiero", the small full names under
  BRI, FAB and ICBC, BRAC's Bangla line, TMB's three-line name beside its monogram), white
  backgrounds removed, and Rabobank's stacked name set beside its symbol, as in its own
  horizontal logo;
- where a logo stacks its name in Hindi over English (Bank of Baroda, Bank of India, Indian Bank,
  Central Bank of India, India Post Payments Bank, Fino), only the English name is kept and set
  centred beside the symbol, the way the banks' English-only versions do; otherwise both lines
  shrink to an unreadable size on a card. Fino keeps its star and name only;
- Lloyds is its 2024 horse set beside its 2024 "LLOYDS BANK" wordmark, as in its horizontal
  logo; Capitec is its wordmark alone (its symbol of overlapping squares turns to a blot in one
  colour);
- three banks publish no vector logo: Equity, Access and Dubai Islamic Bank were traced from the
  largest bitmap available (below), one outline per colour, then cleaned like the rest;
- numbers rounded to far below a pixel at any size.

On cards every logo is printed white (`is-mono`), with its cut-outs in the card's own face
colour. Each `vb` is cropped to the logo's ink, measured from a render of that white print, and
`lib/logos.js` records its shape (`r`), its ink density (`d`) and the height of its lettering
(`t`, measured from the white print's connected shapes: the widest line of letter-sized ones).
Cards size every logo so its lettering stands about as tall as every other's and its ink covers
about as much of the card, the two blended, with a hand-set correction (`s`) from comparing all of
them on cards at 2x. American Express (`color`) prints in its own blue box, as it does on cards. `sym` is the bank's symbol for its tile: a crop
of the logo, or a separate file. A bank with no logo file gets a lockup of the same weight on its
card: its initial cut out of a white tile, and its name.

## Sources

Wikimedia Commons and Wikipedia (upload.wikimedia.org), each checked against the file's SHA-1:

- `abc`: [Agricultural Bank of China logo.svg](https://upload.wikimedia.org/wikipedia/en/6/69/Agricultural_Bank_of_China_logo.svg)
- `abn`: [ABN AMRO logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/81/ABN_AMRO_logo.svg)
- `absa`: [Absa Logo.svg](https://upload.wikimedia.org/wikipedia/commons/a/ae/Absa_Logo.svg)
- `adcb`: [Abu Dhabi Commercial Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/2/25/Abu_Dhabi_Commercial_Bank_logo.svg)
- `ally`: [Ally Financial.svg](https://upload.wikimedia.org/wikipedia/commons/0/00/Ally_Financial.svg)
- `alrajhi`: [Al Rajhi Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/f1/Al_Rajhi_Bank_Logo.svg)
- `anz`: [ANZ Logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/98/ANZ_Logo.svg)
- `asb`: [ASB Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/b/bd/ASB_Bank_Logo.svg)
- `attijari`: [Logo AWB.svg](https://upload.wikimedia.org/wikipedia/en/1/1d/Logo_AWB.svg)
- `banamex`: [Banamex.svg](https://upload.wikimedia.org/wikipedia/commons/5/58/Banamex.svg)
- `bancochile`: [Banco de Chile Logotipo.svg](https://upload.wikimedia.org/wikipedia/commons/e/e5/Banco_de_Chile_Logotipo.svg)
- `bancolombia`: [Bancolombia S.A. logo.svg](https://upload.wikimedia.org/wikipedia/commons/d/dc/Bancolombia_S.A._logo.svg)
- `bangkok`: [Bangkok Bank 2023 (English version).svg](https://upload.wikimedia.org/wikipedia/commons/5/57/Bangkok_Bank_2023_%28English_version%29.svg)
- `bankofchina`: [Bank of China.svg](https://upload.wikimedia.org/wikipedia/en/7/72/Bank_of_China.svg)
- `banorte`: [Banorte (banking and financial services holding company) logo.svg](https://upload.wikimedia.org/wikipedia/en/1/13/Banorte_%28banking_and_financial_services_holding_company%29_logo.svg)
- `banquemisr`: [Banque Misr.svg](https://upload.wikimedia.org/wikipedia/commons/4/49/Banque_Misr.svg)
- `barclays`: [Barclays logo.svg](https://upload.wikimedia.org/wikipedia/en/7/7e/Barclays_logo.svg)
- `bb`: [Banco do Brasil Logo.svg](https://upload.wikimedia.org/wikipedia/commons/5/53/Banco_do_Brasil_Logo.svg)
- `bbva`: [BBVA logo 2025.svg](https://upload.wikimedia.org/wikipedia/commons/9/98/BBVA_logo_2025.svg)
- `bca`: [Bank Central Asia.svg](https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg)
- `bcp`: [Logo-bcp-vector.svg](https://upload.wikimedia.org/wikipedia/commons/0/0d/Logo-bcp-vector.svg)
- `bdo`: [BDO Unibank (logo).svg](https://upload.wikimedia.org/wikipedia/commons/4/49/BDO_Unibank_%28logo%29.svg)
- `bea`: [Bank of East Asia Logo.svg](https://upload.wikimedia.org/wikipedia/commons/5/57/Bank_of_East_Asia_Logo.svg)
- `bmo`: [BMO Logo.svg](https://upload.wikimedia.org/wikipedia/commons/0/03/BMO_Logo.svg)
- `bnp`: [BNP Paribas logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/85/BNP_Paribas_logo.svg)
- `bnz`: [Bank of New Zealand logo.svg](https://upload.wikimedia.org/wikipedia/commons/6/62/Bank_of_New_Zealand_logo.svg)
- `bocom`: [Bank of Communications Logo.svg](https://upload.wikimedia.org/wikipedia/commons/a/a4/Bank_of_Communications_Logo.svg)
- `bofa`: [Bank of America logo.svg](https://upload.wikimedia.org/wikipedia/commons/2/20/Bank_of_America_logo.svg)
- `bpi`: [Bank of the Philippine Islands logo.svg](https://upload.wikimedia.org/wikipedia/en/c/c2/Bank_of_the_Philippine_Islands_logo.svg)
- `brac`: [BRAC Bank Limited Logo.svg](https://upload.wikimedia.org/wikipedia/en/4/4c/BRAC_Bank_Limited_Logo.svg)
- `bradesco`: [Banco Bradesco logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/8a/Banco_Bradesco_logo.svg)
- `bri`: [BRI 2025 (with full name).svg](https://upload.wikimedia.org/wikipedia/commons/9/9a/BRI_2025_%28with_full_name%29.svg)
- `cagricole`: [Crédit Agricole.svg](https://upload.wikimedia.org/wikipedia/en/a/a6/Cr%C3%A9dit_Agricole.svg)
- `caixa`: [Caixa Econômica Federal logo 1997.svg](https://upload.wikimedia.org/wikipedia/commons/3/3c/Caixa_Econ%C3%B4mica_Federal_logo_1997.svg)
- `caixabank`: [CaixaBank logo.svg](https://upload.wikimedia.org/wikipedia/en/b/b8/CaixaBank_logo.svg)
- `capitec`: [Capitec Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/f2/Capitec_Bank_logo.svg)
- `capone`: [Capital One logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/98/Capital_One_logo.svg)
- `ccb`: [China Construction Bank.svg](https://upload.wikimedia.org/wikipedia/en/e/e8/China_Construction_Bank.svg)
- `chase`: [Chase logo 2007.svg](https://upload.wikimedia.org/wikipedia/commons/e/ed/Chase_logo_2007.svg)
- `chime`: [Chime company logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/f6/Chime_company_logo.svg)
- `cib`: [Cib Logo.svg](https://upload.wikimedia.org/wikipedia/commons/b/b1/Cib_Logo.svg)
- `cibc`: [CIBC logo 2021.svg](https://upload.wikimedia.org/wikipedia/en/4/48/CIBC_logo_2021.svg)
- `cimb`: [CIMB Group Logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/8f/CIMB_Group_Logo.svg)
- `citizens`: [Citizens Financial Group logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/9c/Citizens_Financial_Group_logo.svg)
- `cmb`: [China Merchants Bank logo.svg](https://upload.wikimedia.org/wikipedia/en/a/a6/China_Merchants_Bank_logo.svg)
- `combank`: [Commercial Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/fb/Commercial_Bank_logo.svg)
- `commbank`: [Commonwealth Bank logo 2020.svg](https://upload.wikimedia.org/wikipedia/en/9/9c/Commonwealth_Bank_logo_2020.svg)
- `commerz`: [Commerzbank (2009).svg](https://upload.wikimedia.org/wikipedia/commons/4/49/Commerzbank_%282009%29.svg)
- `danske`: [Danske Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/ff/Danske_Bank_Logo.svg)
- `dbbl`: [Dutch-bangla-bank-ltd.svg](https://upload.wikimedia.org/wikipedia/commons/1/16/Dutch-bangla-bank-ltd.svg)
- `desjardins`: [Desjardins Group logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/9d/Desjardins_Group_logo.svg)
- `deutsche`: [Deutsche Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/a/a0/Deutsche_Bank_logo.svg)
- `dnb`: [DNB Logo.svg](https://upload.wikimedia.org/wikipedia/commons/5/53/DNB_Logo.svg)
- `ecobank`: [Ecobank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/98/Ecobank_Logo.svg)
- `erste`: [Erste Group Logo 2023.svg](https://upload.wikimedia.org/wikipedia/commons/e/ea/Erste_Group_Logo_2023.svg)
- `fab`: [First Abu Dhabi Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/2/22/First_Abu_Dhabi_Bank_Logo.svg)
- `fifththird`: [Fifth Third Bank logo (2023, horizontal, color with blue wordmark).svg](https://upload.wikimedia.org/wikipedia/commons/2/28/Fifth_Third_Bank_logo_%282023%2C_horizontal%2C_color_with_blue_wordmark%29.svg)
- `galicia`: [Grupo Financiero Galicia.svg](https://upload.wikimedia.org/wikipedia/commons/4/46/Grupo_Financiero_Galicia.svg)
- `goldman`: [Goldman Sachs logo.svg](https://upload.wikimedia.org/wikipedia/commons/1/1d/Goldman_Sachs_logo.svg)
- `gtbank`: [GTBank logo.svg](https://upload.wikimedia.org/wikipedia/commons/1/14/GTBank_logo.svg)
- `halifax`: [Halifax logo.svg](https://upload.wikimedia.org/wikipedia/en/d/d9/Halifax_logo.svg)
- `hana`: [Hana Bank Logo (eng).svg](https://upload.wikimedia.org/wikipedia/commons/0/09/Hana_Bank_Logo_%28eng%29.svg)
- `handels`: [Handelsbanken.svg](https://upload.wikimedia.org/wikipedia/commons/e/e8/Handelsbanken.svg)
- `hangseng`: [HSB.svg](https://upload.wikimedia.org/wikipedia/en/8/84/Hang_Seng_Bank_%28emblem%29.svg)
- `hapoalim`: [Bank happoalim 2018 logo.svg](https://upload.wikimedia.org/wikipedia/commons/6/66/Bank_happoalim_2018_logo.svg)
- `hbl`: [Logo of Habib Bank.svg](https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_of_Habib_Bank.svg)
- `huntington`: [Huntington Bancshares Inc. logo.svg](https://upload.wikimedia.org/wikipedia/commons/c/ca/Huntington_Bancshares_Inc._logo.svg)
- `icbc`: [Industrial and Commercial Bank of China logo.svg](https://upload.wikimedia.org/wikipedia/en/3/33/Industrial_and_Commercial_Bank_of_China_logo.svg)
- `ing`: [ING Group (full logo).svg](https://upload.wikimedia.org/wikipedia/en/9/96/ING_Group_%28full_logo%29.svg)
- `inter`: [Logo do banco Inter (2023).svg](https://upload.wikimedia.org/wikipedia/commons/8/8f/Logo_do_banco_Inter_%282023%29.svg)
- `intesa`: [Intesa Sanpaolo - logo (Italy, 2007-).svg](https://upload.wikimedia.org/wikipedia/commons/d/d9/Intesa_Sanpaolo_-_logo_%28Italy%2C_2007-%29.svg)
- `itau`: [Banco Itaú logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/8a/Banco_Ita%C3%BA_logo.svg)
- `japanpost`: [Japan Post Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/3/32/Japan_Post_Bank_Logo.svg)
- `jpmorgan`: [J P Morgan Logo 2008 1.svg](https://upload.wikimedia.org/wikipedia/commons/a/af/J_P_Morgan_Logo_2008_1.svg)
- `kb`: [KB logo.svg](https://upload.wikimedia.org/wikipedia/commons/d/d4/KB_logo.svg)
- `kbank`: [KBANK Logo.svg](https://upload.wikimedia.org/wikipedia/en/6/69/KBANK_Logo.svg)
- `kbc`: [KBC logo.svg](https://upload.wikimedia.org/wikipedia/commons/b/b9/KBC_logo.svg)
- `keybank`: [KeyBank logo.svg](https://upload.wikimedia.org/wikipedia/en/7/78/KeyBank_logo.svg)
- `kfh`: [Kuwait Finance House logo.svg](https://upload.wikimedia.org/wikipedia/en/e/ec/Kuwait_Finance_House_logo.svg)
- `kiwibank`: [Kiwibank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/e/ea/Kiwibank_Logo.svg)
- `leumi`: [Bank leumi new logo.svg](https://upload.wikimedia.org/wikipedia/en/2/27/Bank_leumi_new_logo.svg)
- `lloyds`: [Lloyds Bank logo 2024.svg](https://upload.wikimedia.org/wikipedia/en/e/eb/Lloyds_Bank_logo_2024.svg) with [Lloyds Bank 2024 wordmark.svg](https://upload.wikimedia.org/wikipedia/commons/c/c7/Lloyds_Bank_2024_wordmark.svg)
- `macquarie`: [Macquarie Logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/f8/Macquarie_Logo.svg)
- `mandiri`: [Bank Mandiri logo 2016.svg](https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg)
- `mashreq`: [Mashreq logo 2022.svg](https://upload.wikimedia.org/wikipedia/en/5/5c/Mashreq_logo_2022.svg)
- `maybank`: [Maybank logo.svg](https://upload.wikimedia.org/wikipedia/en/d/d7/Maybank_logo.svg)
- `mcb`: [MCB Bank Limited logo (2026).svg](https://upload.wikimedia.org/wikipedia/commons/0/03/MCB_Bank_Limited_logo_%282026%29.svg)
- `meezan`: [Meezan Bank Limited logo (2026).svg](https://upload.wikimedia.org/wikipedia/commons/9/92/Meezan_Bank_Limited_logo_%282026%29.svg)
- `metro`: [Metro Bank logo.svg](https://upload.wikimedia.org/wikipedia/en/6/6d/Metro_Bank_logo.svg)
- `mizuho`: [Mizuho Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/1/14/Mizuho_Bank_logo.svg)
- `monzo`: [Monzo 2022 logo.svg](https://upload.wikimedia.org/wikipedia/commons/b/b2/Monzo_2022_logo.svg)
- `mufg`: [Mitsubishi UFJ logo.svg](https://upload.wikimedia.org/wikipedia/commons/0/0e/Mitsubishi_UFJ_logo.svg)
- `nab`: [National Australia Bank.svg](https://upload.wikimedia.org/wikipedia/en/f/fa/National_Australia_Bank.svg)
- `nationwide`: [Nationwide Building Society logo 2023.svg](https://upload.wikimedia.org/wikipedia/en/2/2f/Nationwide_Building_Society_logo_2023.svg)
- `natwest`: [Natwest logo.svg](https://upload.wikimedia.org/wikipedia/en/d/de/Natwest_logo.svg)
- `navyfed`: [Navy Federal Credit Union Logo.svg](https://upload.wikimedia.org/wikipedia/commons/3/3c/Navy_Federal_Credit_Union_Logo.svg)
- `nbc`: [National Bank of Canada logo.svg](https://upload.wikimedia.org/wikipedia/en/2/2e/National_Bank_of_Canada_logo.svg)
- `nbk`: [NBK.svg](https://upload.wikimedia.org/wikipedia/commons/a/a8/NBK.svg)
- `nedbank`: [Nedbank logo.svg](https://upload.wikimedia.org/wikipedia/en/8/83/Nedbank_logo.svg)
- `nordea`: [Nordea.svg](https://upload.wikimedia.org/wikipedia/commons/8/82/Nordea.svg)
- `ocbc`: [Logo-ocbc.svg](https://upload.wikimedia.org/wikipedia/commons/1/1d/Logo-ocbc.svg)
- `paypal`: [PayPal 2024.svg](https://upload.wikimedia.org/wikipedia/commons/c/c6/PayPal_2024.svg)
- `pnc`: [PNClogo.svg](https://upload.wikimedia.org/wikipedia/commons/1/1b/PNClogo.svg)
- `publicbank`: [Public Bank Berhad logo.svg](https://upload.wikimedia.org/wikipedia/en/2/21/Public_Bank_Berhad_logo.svg)
- `qnb`: [QNB Logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/8f/QNB_Logo.svg)
- `rabo`: [Rabobank logo.svg](https://upload.wikimedia.org/wikipedia/en/5/54/Rabobank_logo.svg)
- `raiffeisen`: [Logo Raiffeisen Bank International RBI relaunch 2023.svg](https://upload.wikimedia.org/wikipedia/commons/c/c3/Logo_Raiffeisen_Bank_International_RBI_relaunch_2023.svg)
- `rakuten`: [Rakuten logo 2.svg](https://upload.wikimedia.org/wikipedia/commons/f/fa/Rakuten_logo_2.svg)
- `rbc`: [RBC Royal Bank.svg](https://upload.wikimedia.org/wikipedia/en/7/7f/RBC_Royal_Bank.svg)
- `rbs`: [Royal Bank of Scotland logo.svg](https://upload.wikimedia.org/wikipedia/en/e/ef/Royal_Bank_of_Scotland_logo.svg)
- `revolut`: [Revolut logo.svg](https://upload.wikimedia.org/wikipedia/commons/7/73/Revolut_logo.svg); symbol: Simple Icons (CC0-1.0) revolut
- `riyad`: [Riyad Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/b/be/Riyad_Bank_logo.svg)
- `santander`: [Banco Santander Logotipo.svg](https://upload.wikimedia.org/wikipedia/commons/b/b8/Banco_Santander_Logotipo.svg)
- `schwab`: [Charles Schwab Corporation logo.svg](https://upload.wikimedia.org/wikipedia/commons/4/4b/Charles_Schwab_Corporation_logo.svg)
- `scotia`: [Scotiabank logo.svg](https://upload.wikimedia.org/wikipedia/commons/2/22/Scotiabank_logo.svg)
- `seb`: [SEB Logo.svg](https://upload.wikimedia.org/wikipedia/commons/6/65/SEB_Logo.svg)
- `shinhan`: [Shinhan Bank Logo (ENG).svg](https://upload.wikimedia.org/wikipedia/commons/e/e9/Shinhan_Bank_Logo_%28ENG%29.svg)
- `siam`: [Siam Commercial Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/f/f5/Siam_Commercial_Bank_Logo.svg)
- `smbc`: [Smbc logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/9e/Smbc_logo.svg)
- `snb`: [Saudi National Bank Logo.svg](https://upload.wikimedia.org/wikipedia/commons/6/62/Saudi_National_Bank_Logo.svg)
- `socgen`: [Logo-SG-Société-Générale.svg](https://upload.wikimedia.org/wikipedia/commons/c/cd/Logo-SG-Soci%C3%A9t%C3%A9-G%C3%A9n%C3%A9rale.svg)
- `sofi`: [SoFi logo.svg](https://upload.wikimedia.org/wikipedia/commons/1/16/SoFi_logo.svg)
- `starling`: [Starling Bank Wordmark Logo.svg](https://upload.wikimedia.org/wikipedia/commons/a/aa/Starling_Bank_Wordmark_Logo.svg)
- `swedbank`: [Swedbank logo.svg](https://upload.wikimedia.org/wikipedia/en/9/99/Swedbank_logo.svg)
- `synchrony`: [Synchrony Financial logo.svg](https://upload.wikimedia.org/wikipedia/commons/2/22/Synchrony_Financial_logo.svg)
- `tangerine`: [Tangerine Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/9b/Tangerine_Bank_logo.svg)
- `td`: [Toronto-Dominion Bank logo.svg](https://upload.wikimedia.org/wikipedia/commons/a/a4/Toronto-Dominion_Bank_logo.svg)
- `truist`: [Truist Financial logo.svg](https://upload.wikimedia.org/wikipedia/commons/8/8b/Truist_Financial_logo.svg)
- `tsb`: [TSB logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/9e/TSB_logo.svg)
- `ubs`: [UBS Logo.svg](https://upload.wikimedia.org/wikipedia/en/a/ab/UBS_Logo.svg)
- `unicredit`: [Unicredit logo.svg](https://upload.wikimedia.org/wikipedia/commons/9/9c/Unicredit_logo.svg)
- `uob`: [UOB Logo (2022).svg](https://upload.wikimedia.org/wikipedia/commons/e/e0/UOB_Logo_%282022%29.svg)
- `usaa`: [USAA logo.svg](https://upload.wikimedia.org/wikipedia/en/e/ec/USAA_logo.svg)
- `usbank`: [US Bank logo 2023 color.svg](https://upload.wikimedia.org/wikipedia/commons/f/ff/US_Bank_logo_2023_color.svg)
- `varo`: [Varo Bank Purple Logo.svg](https://upload.wikimedia.org/wikipedia/commons/0/0f/Varo_Bank_Purple_Logo.svg)
- `vietcombank`: [Vietcombank logo fixed.svg](https://upload.wikimedia.org/wikipedia/commons/e/e3/Vietcombank_logo_fixed.svg)
- `virgin`: [Virgin Money.svg](https://upload.wikimedia.org/wikipedia/en/5/52/Virgin_Money.svg)
- `wells`: [Wells Fargo Logo (2020).svg](https://upload.wikimedia.org/wikipedia/commons/e/e2/Wells_Fargo_Logo_%282020%29.svg)
- `westpac`: [Westpac logo.svg](https://upload.wikimedia.org/wikipedia/commons/a/a7/Westpac_logo.svg)
- `wise`: [Wise Logo 512x124.svg](https://upload.wikimedia.org/wikipedia/commons/e/e8/Wise_Logo_512x124.svg); symbol: Simple Icons (CC0-1.0) wise
- `woori`: [Logo of Woori Bank.svg](https://upload.wikimedia.org/wikipedia/commons/e/e7/Logo_of_Woori_Bank.svg)
- `zenith`: [Zenith Bank logo.svg](https://upload.wikimedia.org/wikipedia/en/d/d6/Zenith_Bank_logo.svg)

[Simple Icons](https://simpleicons.org) (CC0-1.0, v16.34.0):

- `bunq`: bunq
- `cashapp`: cashapp
- `discover`: discover
- `n26`: n26
- `nubank`: nubank
- `sparkasse`: sparkasse
- symbols for the tiles of `mercadopago` (mercadopago), `monzo` (monzo), `paypal` (paypal) and
  `starling` (starlingbank), in each brand's colour

[praveenpuglia/indian-banks](https://github.com/praveenpuglia/indian-banks) (vector logos and
symbols traced from the banks' official material; no licence stated), `assets/logos/`:

- `au`: assets/logos/aubl/logo.svg; symbol: assets/logos/aubl/symbol.svg
- `bob`: assets/logos/barb/logo.svg; symbol: assets/logos/barb/symbol.svg
- `boi`: assets/logos/bkid/logo.svg; symbol: assets/logos/bkid/symbol.svg
- `bom`: assets/logos/mahb/logo.svg; symbol: assets/logos/mahb/symbol.svg
- `central`: assets/logos/cbin/logo.svg; symbol: assets/logos/cbin/symbol.svg
- `csb`: assets/logos/csbk/logo.svg; symbol: assets/logos/csbk/symbol.svg
- `cub`: assets/logos/ciub/logo.svg; symbol: assets/logos/ciub/symbol.svg
- `fino`: assets/logos/fino/logo.svg; symbol: assets/logos/fino/symbol.svg
- `indian`: assets/logos/idib/logo.svg; symbol: assets/logos/idib/symbol.svg
- `kotak`: assets/logos/kkbk/logo.svg
- `psb`: assets/logos/psib/logo.svg; symbol: assets/logos/psib/symbol.svg
- `tmb`: assets/logos/tmbl/logo.svg; symbol: assets/logos/tmbl/symbol.svg
- `uco`: assets/logos/ucba/logo.svg; symbol: assets/logos/ucba/symbol.svg
- `ujjivan`: assets/logos/ujvn/logo.svg; symbol: assets/logos/ujvn/symbol.svg
- `yes`: assets/logos/yesb/logo.svg; symbol: assets/logos/yesb/symbol.svg

[keyushhh/indian-bank-logos](https://github.com/keyushhh/indian-bank-logos) (no licence stated):

- `equitas`: logos/equitas.svg
- `ippb`: logos/ippb.svg
- `jana`: logos/jana.svg
- `slice`: logos/slice.svg
- `suryoday`: logos/suryoday.svg

The banks' own sites:

- `access`: traced from the 1013×289 logo inside https://www.accessbankplc.com/content/images/fx-modal/access.svg
- `enbd`: https://www.emiratesnbd.com/-/media/enbd/images/logos/horizontal_logo.svg
- `fnb`: https://www.fnb.co.za/_assets/images/generic/skins/00/navigation/secondary-logo/header-logo_lrg.svg (its tree symbol; the site has no wordmark file)
- `mercadopago`: https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/7.7.2/mercadopago/logo-footer-v3.svg
- `nabil`: https://assets.nabilbank.com/uploads/logo/nabil%20logo.svg

Traced from Wikipedia's bitmaps (each checked against its SHA-1):

- `dib`: [Dubai-Islamic-Bank-Logo.png](https://upload.wikimedia.org/wikipedia/en/8/8e/Dubai-Islamic-Bank-Logo.png) (397×96)
- `equity`: [Equity Bank Logo.png](https://upload.wikimedia.org/wikipedia/en/8/8a/Equity_Bank_Logo.png) (1656×1171)

[worldvectorlogo](https://worldvectorlogo.com):

- `standardbank`: https://cdn.worldvectorlogo.com/logos/standard-bank.svg

Earlier files, kept:

- `airtel`: Airtel Payments Bank logo.svg — https://upload.wikimedia.org/wikipedia/commons/7/7c/Airtel_Payments_Bank_logo.svg
- `amex`: Simple Icons (see above)
- `axis`: Axis Bank logo.svg — https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg
- `bandhan`: Bandhan Bank Svg Logo.svg — https://upload.wikimedia.org/wikipedia/commons/a/a0/Bandhan_Bank_Svg_Logo.svg
- `canara`: Canara Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/5/50/Canara_Bank_Logo.svg
- `citi`: Citi.svg — https://upload.wikimedia.org/wikipedia/commons/1/1b/Citi.svg
- `dbs`: DBS Bank Logo (alternative).svg — https://upload.wikimedia.org/wikipedia/en/b/b1/DBS_Bank_Logo_%28alternative%29.svg
- `dcb`: Development Credit Bank.svg — https://upload.wikimedia.org/wikipedia/commons/1/19/Development_Credit_Bank.svg
- `dhanlaxmi`: Dhanlaxmi Bank.svg — https://upload.wikimedia.org/wikipedia/en/4/46/Dhanlaxmi_Bank.svg (re-cleaned: "established 1927" dropped)
- `federal`: Federal bank.logo.svg — https://upload.wikimedia.org/wikipedia/commons/1/1c/Federal_bank.logo.svg
- `hdfc`: HDFC Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg
- `hsbc`: HSBC logo (2018).svg — https://upload.wikimedia.org/wikipedia/commons/a/aa/HSBC_logo_%282018%29.svg
- `icici`: ICICI Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg
- `idbi`: IDBI Logo.svg — https://upload.wikimedia.org/wikipedia/en/4/41/IDBI_Logo.svg
- `idfc`: Logo of IDFC First Bank.svg — https://upload.wikimedia.org/wikipedia/commons/3/3f/Logo_of_IDFC_First_Bank.svg
- `indusind`: IndusInd Bank SVG Logo.svg — https://upload.wikimedia.org/wikipedia/commons/4/40/IndusInd_Bank_SVG_Logo.svg
- `iob`: Indian Overseas Bank Logo.svg — https://upload.wikimedia.org/wikipedia/commons/f/fc/Indian_Overseas_Bank_Logo.svg
- `jio`: Simple Icons (see above)
- `jk`: Jammu & Kashmir Bank Logo.svg — https://upload.wikimedia.org/wikipedia/en/1/12/Jammu_%26_Kashmir_Bank_Logo.svg
- `karnataka`: Karnataka Bank svg Logo.svg — https://upload.wikimedia.org/wikipedia/commons/5/55/Karnataka_Bank_svg_Logo.svg (re-cleaned: tagline dropped)
- `kvb`: Karur Vysya Bank.svg — https://upload.wikimedia.org/wikipedia/commons/9/92/Karur_Vysya_Bank.svg (re-cleaned: tagline dropped)
- `pnb`: Punjab National Bank new logo.svg — https://upload.wikimedia.org/wikipedia/commons/b/b2/Punjab_National_Bank_new_logo.svg (the yellow panel behind "pnb" made background, not a cut-out)
- `rbl`: RBL Bank SVG Logo.svg — https://upload.wikimedia.org/wikipedia/commons/7/70/RBL_Bank_SVG_Logo.svg
- `sbi`: State Bank of India logo.svg — https://upload.wikimedia.org/wikipedia/en/5/58/State_Bank_of_India_logo.svg
- `sc`: Standard Chartered (2021).svg — https://upload.wikimedia.org/wikipedia/commons/0/0c/Standard_Chartered_%282021%29.svg
- `sib`: South Indian Bank Logo.svg — https://upload.wikimedia.org/wikipedia/en/2/2f/South_Indian_Bank_Logo.svg
- `union`: Union Bank of India Logo.svg — https://upload.wikimedia.org/wikipedia/commons/d/d0/Union_Bank_of_India_Logo.svg

Network marks in `components/k7/NetworkMark.js`: visa, americanexpress, discover from Simple
Icons (Discover's "O" kept orange, as it prints); RuPay, UnionPay, Mir, Verve from Wikimedia
Commons (RuPay.svg, UnionPay logo.svg, Mir-logo.SVG.svg, Verve Logo 2024.svg); JCB and Diners
Club from Wikimedia Commons too ([JCB logo.svg](https://upload.wikimedia.org/wikipedia/commons/4/40/JCB_logo.svg),
[Diners Club logo.svg](https://upload.wikimedia.org/wikipedia/commons/2/26/Diners_Club_logo.svg)),
cleaned the same way. Mastercard and Maestro are their two circles, drawn in the official
proportions and colours.

Banks not listed here have no usable vector logo yet and get the lockup above.
