//+------------------------------------------------------------------+
//|                                                  W Forex Bot.mq5  |
//|                                  Smart-Grid EA + Live Dashboard  |
//|                                            W Forex Bot · 2026     |
//+------------------------------------------------------------------+
//|  This is the SmartGridEA_Safe_v2 trading logic ENHANCED with a    |
//|  live dashboard link. While it trades gold (XAUUSD) on MT5 it     |
//|  continuously POSTs the account, candles, open trades and history |
//|  to your W Forex website so every position shows up live on the   |
//|  candlestick chart and in the tables.                             |
//|                                                                   |
//|  HOW TO USE                                                       |
//|  1. Copy this file into: MQL5/Experts/  (or open in MetaEditor)   |
//|  2. Compile (F7)  ->  creates "W Forex Bot.ex5"                   |
//|  3. In MT5: Tools > Options > Expert Advisors                     |
//|        tick "Allow WebRequest for listed URL"                     |
//|        add:  https://w-forex-dashboard.onrender.com               |
//|        add:  https://api.telegram.org                             |
//|  4. Drag "W Forex Bot" onto a XAUUSD chart, allow Algo Trading    |
//|  5. Set DashboardURL + DashboardToken (see inputs)                |
//+------------------------------------------------------------------+
#property strict
#property version   "2.00"
#property copyright "W Forex Bot"
#property link      "https://w-forex-dashboard.onrender.com"
#property description "Smart-Grid gold bot with live website dashboard streaming."

#include <Trade/Trade.mqh>
CTrade trade;

//====================================================================
//  INPUTS
//====================================================================
// --- Trading ---
input group            "═══ 1. Strategy (Grid) ═══"
input ulong  MagicNumber           = 20260617;
input double RiskPercent           = 0.3;     // Risk % of balance per lot calc
input double GridStep              = 50;      // Grid step (points)
input double ProfitTarget          = 0.30;    // Take-profit per trade ($)
input int    MaxOpenTrades         = 5;       // Max simultaneous positions
input int    ATRPeriod             = 14;
input double ATRMultiplierSL       = 2.0;     // SL = ATR * multiplier
input int    TrailingStartPoints   = 30;
input int    TrailingStepPoints    = 10;
input int    MAPeriodTrend         = 200;     // Trend filter MA
input double MaxDrawdownPercent    = 5.0;     // Hard stop: max loss %
input int    MaxSpreadPoints       = 30;      // Block trading above this spread
input bool   BlockTradingOnHighSpread = true;

// --- Telegram ---
input group            "═══ 2. Telegram alerts ═══"
input string TelegramToken          = "7970131592:AAFqpL8t7Nj1IbeKR1_vZiaW1wB66jpJx6g";
input string TelegramChatID         = "-1004394697587";
input bool   EnableTelegram         = true;

// --- Dashboard (website) ---
input group            "═══ 3. W Forex Dashboard (live website) ═══"
input string DashboardURL           = "https://w-forex-dashboard.onrender.com/api/ea/data";
input string DashboardToken         = "WFOREX_SECRET";   // must match server AUTH_TOKEN
input bool   EnableDashboard        = true;
input int    DashboardPushSeconds   = 3;       // push every N seconds
input string BotName                = "W Forex Bot";

//====================================================================
//  GLOBALS
//====================================================================
double   buyLevels[];
double   sellLevels[];
int      buyCount = 0, sellCount = 0;
int      atrHandle, maTrendHandle;
bool     isStopped = false;
double   closedLoss = 0.0;
datetime lastLevelUpdate = 0;
datetime lastSpreadWarn  = 0;
datetime lastDashboardPush = 0;
double   sessionProfit = 0.0;
int      totalClosedWins = 0;
int      totalClosedLoss = 0;

//====================================================================
//  HELPERS
//====================================================================
string TimeStr() { return TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES|TIME_SECONDS); }

double GetCurrentSpread()
{
   return (SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID)) / _Point;
}

string AccountInfoStr()
{
   return StringFormat(
      "Balance: %.2f | Equity: %.2f\nMargin: %.2f | Free: %.2f\nSpread: %.1f pips",
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_MARGIN_FREE),
      GetCurrentSpread());
}

//====================================================================
//  TELEGRAM
//====================================================================
void SendTelegram(string msg)
{
   if(!EnableTelegram) return;
   if(TelegramToken == "" || TelegramChatID == "") return;
   string url  = "https://api.telegram.org/bot" + TelegramToken + "/sendMessage";
   string data = "chat_id=" + TelegramChatID + "&text=" + msg;
   uchar post[];
   int len = StringToCharArray(data, post, 0, -1, CP_UTF8);
   if(len <= 0) return;
   string headers = "Content-Type: application/x-www-form-urlencoded; charset=UTF-8\r\n";
   uchar result[];
   string result_headers;
   WebRequest("POST", url, headers, 500, post, result, result_headers);
}

string FormatCloseMessage(string side, double openPrice, double closePrice, double profit,
                          double volume, double balance)
{
   string emoji  = (profit >= 0) ? "✅" : "❌";
   string status = (profit >= 0) ? "PROFIT" : "LOSS";
   double points = (side == "BUY") ? (closePrice - openPrice) / _Point
                                   : (openPrice - closePrice) / _Point;
   double profitPercent = (balance > 0) ? (profit / balance) * 100.0 : 0.0;
   string msg = "";
   msg += emoji + " POSITION CLOSED (" + status + ")\n";
   msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
   msg += "⏰ " + TimeStr() + "\n";
   msg += "💱 " + _Symbol + "\n";
   msg += "📊 Side: " + side + "\n";
   msg += "📈 Open: "  + DoubleToString(openPrice,  _Digits) + "\n";
   msg += "📉 Close: " + DoubleToString(closePrice, _Digits) + "\n";
   msg += "📏 Points: " + DoubleToString(points, 1) + "\n";
   msg += "📦 Volume: " + DoubleToString(volume, 2) + "\n";
   msg += "💰 Profit/Loss: " + DoubleToString(profit, 2) + " $";
   if(profit != 0) msg += " (" + DoubleToString(profitPercent, 2) + "% of balance)";
   msg += "\n";
   msg += "💳 New Balance: " + DoubleToString(balance, 2) + " $\n";
   msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━";
   return msg;
}

string FormatOpenMessage(string side, double price, double sl, double volume, double balance)
{
   string msg = "";
   msg += (side == "BUY LIMIT") ? "📈" : "📉";
   msg += " " + side + " PENDING ORDER PLACED\n";
   msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
   msg += "⏰ " + TimeStr() + "\n";
   msg += "💱 " + _Symbol + "\n";
   msg += "💰 Entry: " + DoubleToString(price, _Digits) + "\n";
   msg += "🛑 Stop Loss: " + DoubleToString(sl, _Digits) + "\n";
   msg += "📦 Volume: " + DoubleToString(volume, 2) + "\n";
   msg += "💳 Balance: " + DoubleToString(balance, 2) + " $\n";
   msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━";
   return msg;
}

//====================================================================
//  INDICATORS
//====================================================================
double GetATR()
{
   double val[1];
   if(CopyBuffer(atrHandle, 0, 0, 1, val) > 0) return val[0];
   return 0.0;
}
double GetMA200()
{
   double val[1];
   if(CopyBuffer(maTrendHandle, 0, 0, 1, val) > 0) return val[0];
   return 0.0;
}

bool IsSpreadOK()
{
   double spread = GetCurrentSpread();
   if(spread <= MaxSpreadPoints) return true;
   if(BlockTradingOnHighSpread)
   {
      if(TimeCurrent() - lastSpreadWarn > 60)
      {
         SendTelegram("⚠️ High Spread: " + DoubleToString(spread, 1) +
                      " pips (Limit: " + IntegerToString(MaxSpreadPoints) + ")\nTrading blocked.");
         lastSpreadWarn = TimeCurrent();
      }
      return false;
   }
   return true;
}

//====================================================================
//  RISK / ACCOUNT
//====================================================================
double LotSize()
{
   double lot = (AccountInfoDouble(ACCOUNT_BALANCE) * RiskPercent / 100.0) / 1000.0;
   return NormalizeDouble(MathMax(0.01, lot), 2);
}

int CountOpenTrades()
{
   int count = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
         if(PositionGetString(POSITION_SYMBOL) == _Symbol) count++;
   }
   return count;
}

double GetFloatingLoss()
{
   double loss = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetDouble(POSITION_PROFIT) < 0)
            loss += PositionGetDouble(POSITION_PROFIT);
      }
   }
   return MathAbs(loss);
}

double GetTotalLoss() { return GetFloatingLoss() + closedLoss; }

bool IsDrawdownExceeded()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance <= 0) return false;
   double lossPercent = (GetTotalLoss() / balance) * 100.0;
   return (lossPercent >= MaxDrawdownPercent);
}

void CloseAllTrades()
{
   Print("🔄 Closing all trades due to drawdown limit");
   SendTelegram("🔄 Closing all trades due to drawdown limit.");
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol)
            trade.PositionClose(ticket);
      }
   }
}

//====================================================================
//  TREND FILTER
//====================================================================
bool IsUptrend()   { return SymbolInfoDouble(_Symbol, SYMBOL_BID) > GetMA200(); }
bool IsDowntrend() { return SymbolInfoDouble(_Symbol, SYMBOL_BID) < GetMA200(); }
bool BuySignal()   { return IsUptrend(); }
bool SellSignal()  { return IsDowntrend(); }

//====================================================================
//  PENDING ORDERS
//====================================================================
bool IsPendingOrderAtLevel(double level, ENUM_ORDER_TYPE type)
{
   for(int i = 0; i < OrdersTotal(); i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket))
      {
         if(OrderGetString(ORDER_SYMBOL) == _Symbol &&
            OrderGetInteger(ORDER_TYPE) == type &&
            MathAbs(OrderGetDouble(ORDER_PRICE_OPEN) - level) < _Point * 0.5)
            return true;
      }
   }
   return false;
}

bool IsPositionAtLevel(double level, ENUM_POSITION_TYPE type)
{
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_TYPE) == type)
         {
            if(MathAbs(PositionGetDouble(POSITION_PRICE_OPEN) - level) < _Point * 0.5)
               return true;
         }
      }
   }
   return false;
}

bool IsLevelFree(double level, ENUM_ORDER_TYPE orderType, ENUM_POSITION_TYPE posType)
{
   return !IsPendingOrderAtLevel(level, orderType) && !IsPositionAtLevel(level, posType);
}

void PlaceBuyLimit(double price, string comment)
{
   if(isStopped) return;
   if(CountOpenTrades() >= MaxOpenTrades) return;
   if(!BuySignal()) return;
   if(!IsSpreadOK()) return;

   double atr = GetATR();
   double slPoints = MathMax(ATRMultiplierSL * atr / _Point, 50);
   double sl  = price - slPoints * _Point;
   double lot = LotSize();
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);

   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   request.action       = TRADE_ACTION_PENDING;
   request.symbol       = _Symbol;
   request.volume       = lot;
   request.price        = price;
   request.sl           = sl;
   request.tp           = 0;
   request.deviation    = 10;
   request.magic        = MagicNumber;
   request.comment      = comment;
   request.type         = ORDER_TYPE_BUY_LIMIT;
   request.type_filling = ORDER_FILLING_FOK;

   if(OrderSend(request, result))
   {
      buyCount++;
      Print("✅ Buy limit placed @ ", price, " SL: ", sl);
      SendTelegram(FormatOpenMessage("BUY LIMIT", price, sl, lot, balance));
   }
   else
   {
      Print("Buy limit failed: ", result.retcode);
   }
}

void PlaceSellLimit(double price, string comment)
{
   if(isStopped) return;
   if(CountOpenTrades() >= MaxOpenTrades) return;
   if(!SellSignal()) return;
   if(!IsSpreadOK()) return;

   double atr = GetATR();
   double slPoints = MathMax(ATRMultiplierSL * atr / _Point, 50);
   double sl  = price + slPoints * _Point;
   double lot = LotSize();
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);

   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   request.action       = TRADE_ACTION_PENDING;
   request.symbol       = _Symbol;
   request.volume       = lot;
   request.price        = price;
   request.sl           = sl;
   request.tp           = 0;
   request.deviation    = 10;
   request.magic        = MagicNumber;
   request.comment      = comment;
   request.type         = ORDER_TYPE_SELL_LIMIT;
   request.type_filling = ORDER_FILLING_FOK;

   if(OrderSend(request, result))
   {
      sellCount++;
      Print("✅ Sell limit placed @ ", price, " SL: ", sl);
      SendTelegram(FormatOpenMessage("SELL LIMIT", price, sl, lot, balance));
   }
   else
   {
      Print("Sell limit failed: ", result.retcode);
   }
}

void CancelPendingOrders()
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket))
      {
         if(OrderGetString(ORDER_SYMBOL) == _Symbol)
         {
            MqlTradeRequest request = {};
            MqlTradeResult  result  = {};
            request.action = TRADE_ACTION_REMOVE;
            request.order  = ticket;
            OrderSend(request, result);
         }
      }
   }
}

//====================================================================
//  MANAGE OPEN TRADES (take profit + trailing stop)
//====================================================================
void CheckAndCloseTrades()
{
   // Close winners that reached target
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      double profit = PositionGetDouble(POSITION_PROFIT);
      if(profit >= ProfitTarget)
         trade.PositionClose(ticket);
   }

   // Trailing stop
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      double profit = PositionGetDouble(POSITION_PROFIT);
      if(profit > 0)
      {
         double openPrice    = PositionGetDouble(POSITION_PRICE_OPEN);
         double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
         ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         double profitPoints = (type == POSITION_TYPE_BUY)
                                 ? (currentPrice - openPrice) / _Point
                                 : (openPrice - currentPrice) / _Point;
         if(profitPoints >= TrailingStartPoints)
         {
            double newSL = (type == POSITION_TYPE_BUY)
                             ? currentPrice - TrailingStepPoints * _Point
                             : currentPrice + TrailingStepPoints * _Point;
            newSL = NormalizeDouble(newSL, _Digits);
            double currentSL = PositionGetDouble(POSITION_SL);
            if(type == POSITION_TYPE_BUY  && newSL > currentSL) trade.PositionModify(ticket, newSL, 0);
            else if(type == POSITION_TYPE_SELL && newSL < currentSL) trade.PositionModify(ticket, newSL, 0);
         }
      }
   }
}

//====================================================================
//  TRADE CLOSE EVENT -> Telegram
//====================================================================
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult  &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;

   HistorySelect(0, TimeCurrent());
   int total = HistoryDealsTotal();
   if(total <= 0) return;

   ulong dealTicket = HistoryDealGetTicket(total - 1);
   if(dealTicket <= 0) return;

   if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol) return;

   long dealType   = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   long entryType  = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   if(entryType != DEAL_ENTRY_OUT) return;

   double profit    = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double volume    = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double closePrice= HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   string side      = (dealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";

   // find matching entry
   double openPrice = 0;
   for(int j = total - 1; j >= 0; j--)
   {
      ulong ticketIn = HistoryDealGetTicket(j);
      if(ticketIn <= 0) continue;
      if(HistoryDealGetInteger(ticketIn, DEAL_ENTRY) == DEAL_ENTRY_IN &&
         HistoryDealGetString(ticketIn, DEAL_SYMBOL) == _Symbol &&
         HistoryDealGetDouble(ticketIn, DEAL_VOLUME) == volume &&
         HistoryDealGetInteger(ticketIn, DEAL_TYPE) == dealType)
      {
         openPrice = HistoryDealGetDouble(ticketIn, DEAL_PRICE);
         break;
      }
   }
   if(openPrice == 0) openPrice = closePrice;

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);

   // bookkeeping
   sessionProfit += profit;
   if(profit >= 0) totalClosedWins++; else totalClosedLoss++;

   SendTelegram(FormatCloseMessage(side, openPrice, closePrice, profit, volume, balance));
}

//====================================================================
//  GRID LEVELS
//====================================================================
void BuildLevels()
{
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   ArrayFree(buyLevels);
   ArrayFree(sellLevels);
   int levelsCount = MaxOpenTrades * 2;
   ArrayResize(buyLevels,  levelsCount);
   ArrayResize(sellLevels, levelsCount);
   for(int i = 0; i < levelsCount; i++)
   {
      buyLevels[i]  = price - (i + 1) * GridStep * _Point;
      sellLevels[i] = price + (i + 1) * GridStep * _Point;
   }
}

void UpdateLevelsIfNeeded()
{
   if(TimeCurrent() - lastLevelUpdate > 300)
   {
      CancelPendingOrders();
      BuildLevels();
      lastLevelUpdate = TimeCurrent();
   }
}

//====================================================================
//  === DASHBOARD STREAMING (NEW) ===
//  Builds a JSON payload and POSTs it to the website every few seconds.
//====================================================================

// Escape a string for JSON safety
string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   return s;
}

// Open trades as JSON array (fields the website expects)
string TradesArrayToJson()
{
   string s = "[";
   bool first = true;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)MagicNumber) continue;

      ENUM_POSITION_TYPE t = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      string side = (t == POSITION_TYPE_BUY) ? "BUY" : "SELL";
      double entry   = PositionGetDouble(POSITION_PRICE_OPEN);
      double current = (t == POSITION_TYPE_BUY)
                         ? SymbolInfoDouble(_Symbol, SYMBOL_BID)
                         : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double sl      = PositionGetDouble(POSITION_SL);
      double tp      = PositionGetDouble(POSITION_TP);
      double profit  = PositionGetDouble(POSITION_PROFIT);
      double lots    = PositionGetDouble(POSITION_VOLUME);
      long   openMs  = (long)PositionGetInteger(POSITION_TIME) * 1000;

      if(!first) s += ",";
      first = false;
      s += "{\"id\":"       + IntegerToString(ticket) +
           ",\"type\":\""   + side + "\"" +
           ",\"symbol\":\"" + _Symbol + "\"" +
           ",\"lots\":"     + DoubleToString(lots, 2) +
           ",\"entry\":"    + DoubleToString(entry, _Digits) +
           ",\"currentPrice\":" + DoubleToString(current, _Digits) +
           ",\"sl\":"       + DoubleToString(sl, _Digits) +
           ",\"tp\":"       + DoubleToString(tp, _Digits) +
           ",\"profit\":"   + DoubleToString(profit, 2) +
           ",\"openTime\":" + IntegerToString(openMs) + "}";
   }
   s += "]";
   return s;
}

// Last N candles as JSON array
string CandlesArrayToJson(int count = 200)
{
   MqlRates rates[];
   int copied = CopyRates(_Symbol, PERIOD_CURRENT, 0, count, rates);
   if(copied <= 0) return "[]";
   ArraySetAsSeries(rates, true);

   string s = "[";
   for(int i = copied - 1; i >= 0; i--)   // ascending by time
   {
      if(i != copied - 1) s += ",";
      s += "{\"time\":"   + IntegerToString((long)rates[i].time) +
           ",\"open\":"   + DoubleToString(rates[i].open,  _Digits) +
           ",\"high\":"   + DoubleToString(rates[i].high,  _Digits) +
           ",\"low\":"    + DoubleToString(rates[i].low,   _Digits) +
           ",\"close\":"  + DoubleToString(rates[i].close, _Digits) +
           ",\"volume\":" + IntegerToString((int)rates[i].tick_volume) + "}";
   }
   s += "]";
   return s;
}

// Recent closed deals as history
string HistoryArrayToJson(int count = 50)
{
   HistorySelect(0, TimeCurrent());
   int total = HistoryDealsTotal();
   if(total <= 0) return "[]";

   string s = "[";
   bool first = true;
   int added = 0;
   for(int i = total - 1; i >= 0 && added < count; i--)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= 0) continue;
      if(HistoryDealGetString(ticket, DEAL_SYMBOL) != _Symbol) continue;
      if(HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;

      double profit  = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double volume  = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double closePx = HistoryDealGetDouble(ticket, DEAL_PRICE);
      long   dealType= HistoryDealGetInteger(ticket, DEAL_TYPE);
      string side    = (dealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      long   closeMs = (long)HistoryDealGetInteger(ticket, DEAL_TIME) * 1000;

      if(!first) s += ",";
      first = false; added++;
      s += "{\"type\":\""   + side + "\"" +
           ",\"symbol\":\"" + _Symbol + "\"" +
           ",\"volume\":"   + DoubleToString(volume, 2) +
           ",\"close\":"    + DoubleToString(closePx, _Digits) +
           ",\"profit\":"   + DoubleToString(profit, 2) +
           ",\"closeTime\":" + IntegerToString(closeMs) + "}";
   }
   s += "]";
   return s;
}

string BuildDashboardJson()
{
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin   = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMarg = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double margLvl  = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   double profit   = equity - balance;
   long   nowMs    = (long)TimeCurrent() * 1000;

   string statusText = isStopped ? "stopped" : (IsSpreadOK() ? "running" : "spread-blocked");

   string json = "{";
   // bot
   json += "\"bot\":{\"name\":\""      + JsonEscape(BotName) + "\"" +
           ",\"symbol\":\""   + _Symbol + "\"" +
           ",\"version\":\"2.00\"" +
           ",\"status\":\""   + statusText + "\"" +
           ",\"online\":true" +
           ",\"lastUpdate\":" + IntegerToString(nowMs) + "},";
   // account
   json += "\"account\":{\"balance\":"    + DoubleToString(balance, 2) +
           ",\"equity\":"     + DoubleToString(equity, 2) +
           ",\"margin\":"     + DoubleToString(margin, 2) +
           ",\"freeMargin\":" + DoubleToString(freeMarg, 2) +
           ",\"marginLevel\":" + DoubleToString(margLvl, 2) +
           ",\"leverage\":"   + IntegerToString((int)AccountInfoInteger(ACCOUNT_LEVERAGE)) +
           ",\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\"" +
           ",\"profit\":"     + DoubleToString(profit, 2) + "},";
   // trades (open positions) — consumed by the website chart + table
   json += "\"trades\":"     + TradesArrayToJson() + ",";
   // positions (kept for backwards compatibility)
   json += "\"positions\":"  + TradesArrayToJson() + ",";
   // candles
   json += "\"candles\":"    + CandlesArrayToJson(200) + ",";
   // history
   json += "\"history\":"    + HistoryArrayToJson(50) + ",";
   // performance
   int    totTrades = totalClosedWins + totalClosedLoss;
   double winRate   = (totTrades > 0) ? (100.0 * totalClosedWins / totTrades) : 0.0;
   json += "\"performance\":{\"totalTrades\":" + IntegerToString(totTrades) +
           ",\"wins\":"      + IntegerToString(totalClosedWins) +
           ",\"losses\":"    + IntegerToString(totalClosedLoss) +
           ",\"winRate\":"   + DoubleToString(winRate, 1) +
           ",\"sessionProfit\":" + DoubleToString(sessionProfit, 2) +
           ",\"openTrades\":"    + IntegerToString(CountOpenTrades()) + "}";
   json += "}";

   return json;
}

void PushToDashboard()
{
   if(!EnableDashboard) return;
   if(DashboardURL == "") return;

   string body = BuildDashboardJson();
   uchar post[];
   int len = StringToCharArray(body, post, 0, -1, CP_UTF8);
   if(len <= 1) return;

   string headers = "Content-Type: application/json\r\n" +
                    "X-Auth-Token: " + DashboardToken + "\r\n" +
                    "Authorization: Bearer " + DashboardToken + "\r\n" +
                    "User-Agent: WForexBot/2.00\r\n";
   uchar result[];
   string result_headers;
   int code = WebRequest("POST", DashboardURL, headers, 5000, post, result, result_headers);
   if(code == -1)
      Print("⚠️ Dashboard push failed (net). err=", GetLastError(),
            "  Make sure '", DashboardURL, "' host is whitelisted in MT5 WebRequest settings.");
}

//====================================================================
//  INIT
//====================================================================
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   atrHandle     = iATR(_Symbol, PERIOD_CURRENT, ATRPeriod);
   maTrendHandle = iMA(_Symbol, PERIOD_CURRENT, MAPeriodTrend, 0, MODE_SMA, PRICE_CLOSE);
   if(atrHandle == INVALID_HANDLE || maTrendHandle == INVALID_HANDLE)
      return INIT_FAILED;

   CancelPendingOrders();
   BuildLevels();

   SendTelegram(
      "🤖 " + BotName + "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "⏰ " + TimeStr() + "\n" +
      "💱 " + _Symbol + "\n" +
      "📈 Step: " + DoubleToString(GridStep, 1) + " pts\n" +
      "📊 Buy Levels: "  + IntegerToString(ArraySize(buyLevels)) + "\n" +
      "📊 Sell Levels: " + IntegerToString(ArraySize(sellLevels)) + "\n" +
      "🛡️ Max Spread: " + IntegerToString(MaxSpreadPoints) + " pts\n" +
      "🛡️ Max Loss: " + DoubleToString(MaxDrawdownPercent, 1) + "%\n" +
      "🌐 Dashboard: " + (EnableDashboard ? "ON → " + DashboardURL : "OFF") + "\n" +
      AccountInfoStr()
   );

   // first push so the website lights up immediately
   PushToDashboard();
   return INIT_SUCCEEDED;
}

//====================================================================
//  ONTICK
//====================================================================
void OnTick()
{
   static datetime lastCheck = 0;
   if(TimeCurrent() - lastCheck < 1) return;
   lastCheck = TimeCurrent();

   // --- dashboard push on its own cadence ---
   if(TimeCurrent() - lastDashboardPush >= DashboardPushSeconds)
   {
      PushToDashboard();
      lastDashboardPush = TimeCurrent();
   }

   // --- drawdown safety ---
   if(IsDrawdownExceeded() && !isStopped)
   {
      isStopped = true;
      CloseAllTrades();
      CancelPendingOrders();
      SendTelegram("⛔ Bot stopped due to max drawdown (" +
                   DoubleToString(MaxDrawdownPercent, 1) + "%).");
      PushToDashboard();
      return;
   }

   CheckAndCloseTrades();
   UpdateLevelsIfNeeded();

   if(isStopped || CountOpenTrades() >= MaxOpenTrades) return;
   if(!IsSpreadOK()) return;

   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   for(int i = 0; i < ArraySize(buyLevels); i++)
   {
      if(price <= buyLevels[i] &&
         IsLevelFree(buyLevels[i], ORDER_TYPE_BUY_LIMIT, POSITION_TYPE_BUY))
         PlaceBuyLimit(buyLevels[i], "GridBuyLimit");
   }
   for(int i = 0; i < ArraySize(sellLevels); i++)
   {
      if(price >= sellLevels[i] &&
         IsLevelFree(sellLevels[i], ORDER_TYPE_SELL_LIMIT, POSITION_TYPE_SELL))
         PlaceSellLimit(sellLevels[i], "GridSellLimit");
   }
}

//====================================================================
//  ONDEINIT
//====================================================================
void OnDeinit(const int reason)
{
   if(atrHandle     != INVALID_HANDLE) IndicatorRelease(atrHandle);
   if(maTrendHandle != INVALID_HANDLE) IndicatorRelease(maTrendHandle);
   CancelPendingOrders();
   SendTelegram("🛑 " + BotName + " stopped.");
   // final state push (mark as offline)
   PushToDashboard();
}
//+------------------------------------------------------------------+
