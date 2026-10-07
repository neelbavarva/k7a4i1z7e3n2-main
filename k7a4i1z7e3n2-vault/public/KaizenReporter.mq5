//+------------------------------------------------------------------+
//| Kaizen Reporter                                                   |
//| Sends this MT5 account's balance, equity, margin and open         |
//| positions to your Kaizen API every minute, for the vault's net    |
//| worth page.                                                       |
//|                                                                   |
//| Read only: it never places, changes or closes a trade. It works   |
//| logged in with the investor password, and with Algo Trading off.  |
//|                                                                   |
//| Setup                                                             |
//|  1. MT5: File > Open Data Folder > MQL5 > Experts, put this file  |
//|     there, then right-click Experts in the Navigator > Refresh.   |
//|  2. Tools > Options > Expert Advisors: tick "Allow WebRequest for |
//|     listed URL" and add https://k7a4i1z7e3n2.onrender.com         |
//|  3. Drag Kaizen Reporter onto any chart. In Inputs, paste your    |
//|     push token (MT5_PUSH_TOKEN on the API server). OK.            |
//| One chart per account is enough. It reports while MT5 is open.   |
//+------------------------------------------------------------------+
#property copyright "Kaizen"
#property version   "1.00"
#property description "Reports this account's balance, equity and open positions to your Kaizen API. Never trades."

input string ApiUrl       = "https://k7a4i1z7e3n2.onrender.com/mt5/push"; // Where to send
input string PushToken    = "";                                           // MT5_PUSH_TOKEN from the API server
input int    EverySeconds = 60;                                           // How often (at least 15)

int OnInit()
  {
   if(StringLen(PushToken) == 0)
     {
      Print("Kaizen Reporter: paste your push token in the Inputs tab");
      return(INIT_PARAMETERS_INCORRECT);
     }
   EventSetTimer(MathMax(15, EverySeconds));
   Send();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   Send();
  }

string Esc(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return(s);
  }

string Str(string key, string value) { return("\"" + key + "\":\"" + Esc(value) + "\""); }
string Num(string key, double value, int digits = 2) { return("\"" + key + "\":" + DoubleToString(value, digits)); }

void Send()
  {
   string json = "{";
   json += Str("login", IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))) + ",";
   json += Str("server", AccountInfoString(ACCOUNT_SERVER)) + ",";
   json += Str("company", AccountInfoString(ACCOUNT_COMPANY)) + ",";
   json += Str("name", AccountInfoString(ACCOUNT_NAME)) + ",";
   json += Str("currency", AccountInfoString(ACCOUNT_CURRENCY)) + ",";
   json += Num("leverage", (double)AccountInfoInteger(ACCOUNT_LEVERAGE), 0) + ",";
   json += Num("balance", AccountInfoDouble(ACCOUNT_BALANCE)) + ",";
   json += Num("equity", AccountInfoDouble(ACCOUNT_EQUITY)) + ",";
   json += Num("margin", AccountInfoDouble(ACCOUNT_MARGIN)) + ",";
   json += Num("freeMargin", AccountInfoDouble(ACCOUNT_MARGIN_FREE)) + ",";
   json += Num("marginLevel", AccountInfoDouble(ACCOUNT_MARGIN_LEVEL)) + ",";
   json += "\"positions\":[";

   int sent = 0;
   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      if(sent > 0)
         json += ",";
      json += "{";
      json += Str("ticket", IntegerToString((long)ticket)) + ",";
      json += Str("symbol", symbol) + ",";
      json += Str("type", PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL ? "sell" : "buy") + ",";
      json += Num("volume", PositionGetDouble(POSITION_VOLUME)) + ",";
      json += Num("openPrice", PositionGetDouble(POSITION_PRICE_OPEN), digits) + ",";
      json += Num("currentPrice", PositionGetDouble(POSITION_PRICE_CURRENT), digits) + ",";
      json += Num("profit", PositionGetDouble(POSITION_PROFIT)) + ",";
      json += Num("swap", PositionGetDouble(POSITION_SWAP));
      json += "}";
      sent++;
     }
   json += "]}";

   char data[];
   int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, MathMax(0, len - 1)); // drop the closing zero
   char result[];
   string answerHeaders;
   string headers = "Content-Type: application/json\r\nx-push-token: " + PushToken + "\r\n";

   ResetLastError();
   int code = WebRequest("POST", ApiUrl, headers, 15000, data, result, answerHeaders);
   if(code == -1)
      Print("Kaizen Reporter: allow the API under Tools > Options > Expert Advisors > Allow WebRequest (error ", GetLastError(), ")");
   else if(code != 200)
      Print("Kaizen Reporter: the server answered ", code, ": ", CharArrayToString(result));
  }
