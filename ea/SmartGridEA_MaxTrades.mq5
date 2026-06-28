//+------------------------------------------------------------------+
//|                                       SmartGridEA_MaxTrades.mq5   |
//|                    W Forex · Smart Grid Bot · MT5 Mirror Edition |
//|  إغلاق عند الربح + إغلاق جماعي للخاسرين + إشارة استئناف (MA)      |
//|  الحد الأقصى للصفقات: 15  ·  إرسال حيّ لموقع/تطبيق W Forex         |
//|                          © 2026 — W Forex VIP                     |
//+------------------------------------------------------------------+
#property strict
#property copyright "2026, W Forex VIP"
#property version   "1.10"
#property description "Smart Grid Bot — MT5 mirror for W Forex dashboard & mobile app"

#include <Trade/Trade.mqh>
CTrade trade;

//====================================================================
//                         المدخلات العامة
//====================================================================
input group            "═══ 1. الهوية  ═══"
input ulong  MagicNumber        = 20260617;          // الماجيك نمبر
input string BotName            = "W Forex SmartGrid";// اسم البوت

input group            "═══ 2. المخاطرة  ═══"
input double RiskPercent        = 0.5;               // نسبة المخاطرة لكل صفقة
input double GridStep           = 10;                // الخطوة بين المستويات (نقطة)
input double ProfitTarget       = 0.30;              // هدف الربح بالدولار للصفقة الواحدة
input int    MaxLosingTrades    = 20;                // عدد الخاسرة قبل الإغلاق الجماعي
input int    MaxOpenTrades      = 15;                // الحد الأقصى للصفقات المفتوحة

input group            "═══ 3. إشارة الاستئناف  ═══"
input int    MAPeriod           = 20;                // فترة المتوسط المتحرك

input group            "═══ 4. Telegram  ═══"
input string TelegramToken     = "7970131592:AAFqpL8t7Nj1IbeKR1_vZiaW1wB66jpJx6g";
input string TelegramChatID    = "-1004394697587";
input bool   EnableTelegram    = true;

input group            "═══ 5. W Forex Dashboard (إرسال حيّ للموقع/التطبيق)  ═══"
input string DashboardURL      = "https://w-forex-dashboard.onrender.com/api/ea/data"; // رابط السيرفر
input string DashboardToken    = "WFOREX_SECRET";               // التوكن
input bool   EnableDashboard   = true;                               // تفعيل البث الحي
input int    DashboardPushMs   = 1500;                               // الفاصل بين التحديثات (ms)

//====================================================================
//                         المتغيرات العامة
//====================================================================
double   buyLevels[];
double   sellLevels[];
int      buyCount = 0, sellCount = 0;
bool     isTradingPaused = false;
int      maHandle;
ulong    lastTicket = 0;
ulong    sessionStart = 0;
int      totalClosedWins  = 0;
int      totalClosedLoss  = 0;
double   sessionProfit    = 0.0;
string   statusText       = "running";
datetime lastDashboardPush = 0;

//====================================================================
//                         دوال Telegram
//====================================================================
void SendTelegram(string msg)
{
   if(!EnableTelegram) return;
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

//====================================================================
//                         دوال إدارة الصفقات
//====================================================================
double LotSize()
{
   double lot = (AccountInfoDouble(ACCOUNT_BALANCE) * RiskPercent / 100.0) / 1000.0;
   return NormalizeDouble(MathMax(0.01, lot), 2);
}

bool CheckMargin(double lot)
{
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginReq  = (SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE) * lot *
                        SymbolInfoDouble(_Symbol, SYMBOL_BID)) / AccountInfoInteger(ACCOUNT_LEVERAGE);
   if(freeMargin - marginReq < 10) return false;
   return true;
}

int CountOpenTrades()
{
   int count = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_MAGIC) == (long)MagicNumber)
            count++;
      }
   }
   return count;
}

bool IsPositionAtLevel(double level, ENUM_POSITION_TYPE type)
{
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_MAGIC)  == (long)MagicNumber &&
            PositionGetInteger(POSITION_TYPE)   == type)
         {
            if(MathAbs(PositionGetDouble(POSITION_PRICE_OPEN) - level) < _Point * 0.5)
               return true;
         }
      }
   }
   return false;
}

//====================================================================
//                    فتح الصفقات (بدون SL/TP)
//====================================================================
void OpenBuy(string comment, double price)
{
   if(isTradingPaused) { Print("⏸️ التداول متوقف، لا يمكن فتح شراء"); return; }
   if(CountOpenTrades() >= MaxOpenTrades)
   {
      Print("⚠️ تم الوصول للحد الأقصى للصفقات (", MaxOpenTrades, ")");
      return;
   }
   double lot = LotSize();
   if(!CheckMargin(lot)) { Print("⚠️ هامش غير كافٍ للشراء"); return; }

   if(trade.Buy(lot, _Symbol, 0, 0, 0, comment))
   {
      buyCount++;
      Print("✅ شراء عند ", price);
      SendTelegram("📈 BUY OPEN\nPrice: " + DoubleToString(price, _Digits) +
                   "\nLot: " + DoubleToString(lot, 2) +
                   "\nOpen Trades: " + IntegerToString(CountOpenTrades()));
   }
   else Print("❌ فشل شراء، خطأ: ", GetLastError());
}

void OpenSell(string comment, double price)
{
   if(isTradingPaused) { Print("⏸️ التداول متوقف، لا يمكن فتح بيع"); return; }
   if(CountOpenTrades() >= MaxOpenTrades)
   {
      Print("⚠️ تم الوصول للحد الأقصى للصفقات (", MaxOpenTrades, ")");
      return;
   }
   double lot = LotSize();
   if(!CheckMargin(lot)) { Print("⚠️ هامش غير كافٍ للبيع"); return; }

   if(trade.Sell(lot, _Symbol, 0, 0, 0, comment))
   {
      sellCount++;
      Print("✅ بيع عند ", price);
      SendTelegram("📉 SELL OPEN\nPrice: " + DoubleToString(price, _Digits) +
                   "\nLot: " + DoubleToString(lot, 2) +
                   "\nOpen Trades: " + IntegerToString(CountOpenTrades()));
   }
   else Print("❌ فشل بيع، خطأ: ", GetLastError());
}

//====================================================================
//               إغلاق الصفقات التي حققت الربح المطلوب
//====================================================================
void CheckAndCloseProfitableTrades()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)MagicNumber) continue;

      double profit = PositionGetDouble(POSITION_PROFIT);
      if(profit >= ProfitTarget)
      {
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double volume    = PositionGetDouble(POSITION_VOLUME);
         ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

         if(trade.PositionClose(ticket))
         {
            totalClosedWins++;
            sessionProfit += profit;
            Print("✅ إغلاق صفقة بربح: ", profit, "$");
            string side = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            SendTelegram(
               "✅ POSITION CLOSED (Profit Target)\n" +
               "Side: " + side + "\n" +
               "Open: " + DoubleToString(openPrice, _Digits) + "\n" +
               "Profit: " + DoubleToString(profit, 2) + " $\n" +
               "Lot: " + DoubleToString(volume, 2));
         }
      }
   }
}

//====================================================================
//                    إغلاق جماعي للصفقات الخاسرة
//====================================================================
int CountLosingTrades()
{
   int count = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_MAGIC) == (long)MagicNumber &&
            PositionGetDouble(POSITION_PROFIT) < 0)
            count++;
      }
   }
   return count;
}

void CloseAllTrades()
{
   Print("🔄 إغلاق جميع الصفقات (السبب: تجاوز عدد الخاسرين)");
   SendTelegram("🔄 Closing all trades due to losing trades limit reached");
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_MAGIC) == (long)MagicNumber)
         {
            double p = PositionGetDouble(POSITION_PROFIT);
            trade.PositionClose(ticket);
            if(p < 0) totalClosedLoss++; else totalClosedWins++;
            sessionProfit += p;
         }
      }
   }
   isTradingPaused = true;
   statusText      = "paused";
   SendTelegram("⏸️ Trading paused until signal appears.");
}

//====================================================================
//                 التحقق من إشارة الاستئناف (MA)
//====================================================================
bool CheckResumeSignal()
{
   double ma[];
   ArraySetAsSeries(ma, true);
   if(CopyBuffer(maHandle, 0, 0, 1, ma) < 1) return false;
   double currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(currentPrice > ma[0]) return true;
   return false;
}

//====================================================================
//                       بناء المستويات
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
   Print("✅ تم بناء المستويات، سعر البداية: ", price);
}

//====================================================================
//           بناء حمولة JSON للسيرفر (الصفقات + الحساب + الشموع)
//====================================================================
string PosArrayToJson()
{
   string s = "[";
   bool first = true;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)MagicNumber) continue;

      if(!first) s += ",";
      first = false;
      ENUM_POSITION_TYPE t = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      s += "{\"ticket\":"    + IntegerToString(ticket) +
           ",\"type\":\""    + (t == POSITION_TYPE_BUY ? "buy" : "sell") + "\"" +
           ",\"open\":"      + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), _Digits) +
           ",\"current\":"   + DoubleToString((t==POSITION_TYPE_BUY ?
                                               SymbolInfoDouble(_Symbol,SYMBOL_BID):
                                               SymbolInfoDouble(_Symbol,SYMBOL_ASK)), _Digits) +
           ",\"lots\":"      + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) +
           ",\"profit\":"    + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) +
           ",\"sl\":"        + DoubleToString(PositionGetDouble(POSITION_SL), _Digits) +
           ",\"tp\":"        + DoubleToString(PositionGetDouble(POSITION_TP), _Digits) +
           ",\"time\":"      + IntegerToString((long)PositionGetInteger(POSITION_TIME)) +
           ",\"symbol\":\""  + _Symbol + "\"}";
   }
   s += "]";
   return s;
}

string CandleArrayToJson()
{
   // آخر 240 شمعة M1
   string s = "[";
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M1, 0, 240, rates);
   for(int i = copied - 1; i >= 0; i--)
   {
      if(i != copied - 1) s += ",";
      s += "{\"time\":"  + IntegerToString(rates[i].time) +
           ",\"open\":"  + DoubleToString(rates[i].open, _Digits) +
           ",\"high\":"  + DoubleToString(rates[i].high, _Digits) +
           ",\"low\":"   + DoubleToString(rates[i].low, _Digits) +
           ",\"close\":" + DoubleToString(rates[i].close, _Digits) +
           ",\"volume\":"+ IntegerToString(rates[i].tick_volume) + "}";
   }
   s += "]";
   return s;
}

string BuildDashboardJson()
{
   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity    = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin    = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMarg  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double margLvl   = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   double bid       = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double profit    = equity - balance;

   string json = "{";
   // bot
   json += "\"bot\":{\"name\":\"" + BotName + "\","
         + "\"symbol\":\"" + _Symbol + "\","
         + "\"version\":\"1.10\","
         + "\"status\":\"" + statusText + "\","
         + "\"source\":\"mt5\","
         + "\"online\":true,"
         + "\"uptime\":" + IntegerToString((long)(TimeCurrent() - sessionStart)) + ","
         + "\"lastUpdate\":" + IntegerToString((long)TimeCurrent()) + ","
         + "\"maxTrades\":" + IntegerToString(MaxOpenTrades) + ","
         + "\"profitTarget\":" + DoubleToString(ProfitTarget, 2) + ","
         + "\"gridStep\":" + DoubleToString(GridStep, 1) + ","
         + "\"tradingPaused\":" + (isTradingPaused ? "true" : "false") + "},";
   // account
   json += "\"account\":{\"balance\":" + DoubleToString(balance, 2) +
           ",\"equity\":"  + DoubleToString(equity, 2) +
           ",\"profit\":"  + DoubleToString(profit, 2) +
           ",\"margin\":"  + DoubleToString(margin, 2) +
           ",\"freeMargin\":" + DoubleToString(freeMarg, 2) +
           ",\"marginLevel\":" + DoubleToString(margLvl == 0 ? 0 : margLvl / 100.0, 2) +
           ",\"leverage\":" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LEVERAGE)) +
           ",\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\"},";
   // price
   json += "\"price\":" + DoubleToString(bid, _Digits) + ",";
   // stats
   json += "\"stats\":{\"wins\":" + IntegerToString(totalClosedWins) +
           ",\"losses\":" + IntegerToString(totalClosedLoss) +
           ",\"sessionProfit\":" + DoubleToString(sessionProfit, 2) +
           ",\"openTrades\":" + IntegerToString(CountOpenTrades()) + "},";
   // positions
   json += "\"positions\":" + PosArrayToJson() + ",";
   // candles
   json += "\"candles\":" + CandleArrayToJson();
   json += "}";
   return json;
}

//====================================================================
//          إرسال الحمولة للسيرفر (الموقع/التطبيق)
//====================================================================
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
                    "User-Agent: WForexMT5/1.10\r\n";
   uchar result[];
   string result_headers;
   int code = WebRequest("POST", DashboardURL, headers, 3000, post, result, result_headers);
   if(code == -1) Print("⚠️ Dashboard push failed (net). err=", GetLastError());
}

//====================================================================
//                              INIT
//====================================================================
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   maHandle = iMA(_Symbol, PERIOD_CURRENT, MAPeriod, 0, MODE_SMA, PRICE_CLOSE);
   if(maHandle == INVALID_HANDLE)
   {
      Print("❌ فشل إنشاء مؤشر المتوسط المتحرك");
      return INIT_FAILED;
   }
   BuildLevels();
   isTradingPaused = false;
   sessionStart    = TimeCurrent();
   statusText      = "running";
   lastTicket      = 0;

   SendTelegram(
      "🤖 " + BotName + " Started\n" +
      "Symbol: " + _Symbol + "\n" +
      "Profit Target: " + DoubleToString(ProfitTarget, 2) + " $\n" +
      "Max Open Trades: " + IntegerToString(MaxOpenTrades) + "\n" +
      "Max Losing Trades: " + IntegerToString(MaxLosingTrades) + "\n" +
      "Grid Step: " + DoubleToString(GridStep, 1) + " pips\n" +
      "Dashboard: " + (EnableDashboard ? "ON" : "OFF"));

   // أول إرسال فوري
   PushToDashboard();
   return INIT_SUCCEEDED;
}

//====================================================================
//                              ONTICK
//====================================================================
void OnTick()
{
   static datetime lastCheck = 0;
   if(TimeCurrent() - lastCheck < 2) { goto DASH; }
   lastCheck = TimeCurrent();

   // 1. إغلاق الصفقات التي حققت الهدف
   CheckAndCloseProfitableTrades();

   // 2. التحقق من عدد الصفقات الخاسرة
   int losingCount = CountLosingTrades();
   if(losingCount >= MaxLosingTrades && !isTradingPaused)
      CloseAllTrades();

   // 3. إذا كان التداول متوقفاً، نتحقق من الإشارة لاستئناف التداول
   if(isTradingPaused)
   {
      if(CheckResumeSignal())
      {
         isTradingPaused = false;
         statusText      = "running";
         BuildLevels();
         SendTelegram("▶️ Signal detected. Trading resumed.");
         Print("▶️ تم استئناف التداول بناءً على الإشارة");
      }
      goto DASH;
   }

   // 4. فتح صفقات جديدة (فقط إذا لم نصل للحد الأقصى)
   if(CountOpenTrades() >= MaxOpenTrades) goto DASH;

   {
      double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      for(int i = 0; i < ArraySize(buyLevels); i++)
      {
         if(price <= buyLevels[i] && !IsPositionAtLevel(buyLevels[i], POSITION_TYPE_BUY))
         {
            OpenBuy("GridBuy", buyLevels[i]);
            if(CountOpenTrades() >= MaxOpenTrades) break;
         }
      }
      for(int i = 0; i < ArraySize(sellLevels); i++)
      {
         if(price >= sellLevels[i] && !IsPositionAtLevel(sellLevels[i], POSITION_TYPE_SELL))
         {
            OpenSell("GridSell", sellLevels[i]);
            if(CountOpenTrades() >= MaxOpenTrades) break;
         }
      }
   }

DASH:
   // إرسال دوري للسيرفر (الموقع/التطبيق)
   uint now_ms = GetTickCount();
   if((int)(now_ms) - (int)((uint)lastDashboardPush) >= DashboardPushMs ||
       lastDashboardPush == 0)
   {
      PushToDashboard();
      lastDashboardPush = (datetime)now_ms;
   }
}

//====================================================================
//                            ONDEINIT
//====================================================================
void OnDeinit(const int reason)
{
   if(maHandle != INVALID_HANDLE) IndicatorRelease(maHandle);
   SendTelegram("🛑 " + BotName + " Stopped\nBuy: " + IntegerToString(buyCount) +
                " | Sell: " + IntegerToString(sellCount));
   Print("تم إيقاف البوت، شراء: ", buyCount, " بيع: ", sellCount);
}
//+------------------------------------------------------------------+
