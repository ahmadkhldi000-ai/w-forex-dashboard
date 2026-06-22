//+------------------------------------------------------------------+
//|                                        InstitutionalHedgeEA.mq5  |
//|        High-Frequency Scalper + Self-Learning engine             |
//|   Opens many LONG & SHORT trades, takes small profits quickly   |
//+------------------------------------------------------------------+
#property copyright "2026"
#property version   "3.00"

#include <Trade/Trade.mqh>

CTrade trade;

//================ CORE INPUTS =================
input ulong  MagicNumber             = 20260620;
input string SymbolsList             = "XAUUSD,GBPUSD,EURUSD"; // reserved

// Scalping engine (LOW-FREQUENCY mode: fewer trades, larger targets)
input bool   UseScalping             = true;
input bool   AllowHedge              = true;       // open LONG and SHORT simultaneously
input double MicroTP_USD            = 2.50;        // close each trade at this small profit
input double MicroSL_USD            = 6.00;        // emergency stop per trade (USD)
input double ScalpTP_Points         = 60;          // alt: TP in points (0 = use USD)
input double ScalpSL_Points         = 200;         // alt: SL in points
input int    ScalpCooldownSec       = 30;          // slower re-entry (low-frequency)
input int    MaxScalpPositions      = 4;           // total open positions cap
input int    MaxScalpPerSide        = 2;           // cap per direction
input double MicroLots              = 0.01;        // base lot size
input bool   UseMartingaleMicro     = true;        // tiny lot bump after loss
input double MartingaleMult         = 1.3;         // lot multiplier after loss
input double MartingaleMaxLots      = 0.30;        // cap martingale lot

// Signal triggers (micro)
input int    MicroMA_Fast           = 5;           // very fast EMA
input int    MicroMA_Slow           = 13;          // slow micro EMA
input int    MicroRSI_Period        = 5;
input double RSI_Oversold           = 25.0;        // BUY zone
input double RSI_Overbought         = 75.0;        // SELL zone
input int    MomentumBars           = 2;           // momentum lookback
input bool   RequirePriceAction     = true;        // confirm with last bar direction

// Regime AI
input bool   UseRegimeAI            = true;
input double ADX_Trend_Threshold    = 25.0;
input double ATR_SPIKE_MULTIPLIER   = 2.0;

// Risk
input double BaseRiskPercent        = 0.5;
input double MaxRiskCapUSD          = 80.0;
input double MaxDrawdownPercent     = 6.0;
input double MaxBasketDrawdownUSD   = 25.0;
input double RecoveryThresholdPercent= 2.0;

// Grid (wider spacing = fewer, safer entries)
input bool   UseSmartGrid           = true;
input double ATR_GridMultiplier     = 1.5;         // wider grid = fewer entries
input double Grid_ExpandVolatility  = 1.8;
input int    MaxGridLevelsPerSide   = 3;
input double GridLotMultiplier      = 1.10;

// Basket (larger target = fewer but bigger closes)
input bool   UseBasketManager       = true;
input double BasketProfitTargetUSD  = 8.0;         // larger target = bigger closes
input double BasketHalfClosePercent = 50.0;
input double BasketTrailStartUSD    = 4.0;
input double BasketTrailStepUSD     = 1.5;

// Execution
input int    MaxSpreadPoints        = 25;
input int    CooldownSeconds        = 30;
input double MaxNetExposureLots     = 3.0;
input int    MaxPositionsPerSide    = 2;
input int    MinBarsBetweenTrades   = 2;          // low-frequency: min bars between new entries
input double MinPriceDistanceATR    = 0.5;        // min distance from last entry (in ATR units)

// Trend (regime detection)
input int    ATR_Period             = 14;
input int    ADX_Period             = 14;
input int    EMA_Fast               = 20;
input int    EMA_Slow               = 50;
input int    RSI_Period             = 14;

// Telegram (Professional Messaging System)
input bool   UseTelegram            = true;
input string TelegramToken          = "";           // from @BotFather
input string TelegramChatID         = "";           // your chat id
input int    TelegramCooldownSec    = 5;            // min seconds between sends
input bool   TelegramUseHTML        = true;         // rich formatting (bold, colors)
input bool   TelegramEmojiSafe      = true;         // use emojis in messages
input string BotName                = "Hedge Scalper"; // shown in headers
input bool   TGBatchTrades          = true;         // group trades, send summary
input int    TGBatchWindowSec       = 15;           // batch accumulation window
input bool   TGNotifyOpen           = true;         // notify on new trade open
input bool   TGNotifyClose          = true;         // notify on trade close
input bool   TGNotifyRegime         = true;         // notify on regime change
input bool   TGNotifyRisk           = true;         // notify on risk events
input int    DailyReportHour        = 23;
input int    DailyReportMinute      = 55;
input bool   WeeklyReportEnabled    = true;
input int    WeeklyReportDay        = 7;

// CSV
input bool   UseCSVLogger           = true;
input string CSVFileName            = "scalper_hedge_log.csv";

// Self-Learning
input bool   UseSelfLearning        = true;
input string LearningFile           = "ih_learning.bin";
input int    MinTradesToAdapt       = 5;
input double AdaptStepRisk          = 0.05;
input double AdaptStepGrid          = 0.05;
input double WinRateTarget          = 0.55;
input int    LearningSaveSeconds    = 300;
input double LearnRiskMultMin       = 0.5;
input double LearnRiskMultMax       = 2.0;
input double LearnGridMultMin       = 0.7;
input double LearnGridMultMax       = 1.6;

// Adaptive Strategy Selection (multi-regime mastery)
input bool   UseAdaptiveStrategy    = true;          // learn best strategy per regime
input int    StratSwitchMinTrades   = 10;            // need this many trades before switching
input double StratSwitchMargin      = 0.15;          // win-rate margin to justify switch
input double Trend_TP_USD           = 5.0;           // trend-following TP
input double Trend_SL_USD           = 6.0;
input double Range_TP_USD           = 1.5;           // mean-reversion TP (small)
input double Range_SL_USD           = 2.5;
input double Breakout_TP_USD        = 8.0;           // breakout TP (larger)
input double Breakout_SL_USD        = 3.5;
input double StratConfidenceMin     = 0.3;           // min confidence to trust a strategy
input double StratConfidenceMax     = 1.0;
input double StratConfidenceStep    = 0.10;          // how fast confidence changes

//================ DASHBOARD (Live Web Server) =================
input bool   UseDashboard           = true;          // push live state to web dashboard
input string DashboardURL           = "https://w-forex-dashboard.onrender.com"; // no trailing slash
input string DashboardToken         = "WFOREX_SECRET_2026";   // must match AUTH_TOKEN on server
input int    DashboardPushSec       = 5;             // seconds between pushes (min 2)
input int    DashboardMode          = 1;             // 0=off, 1=on. For quick disable

//================ GLOBALS =================
int      atrH, adxH, emaF_H, emaS_H, rsiH, csvH = INVALID_HANDLE;
int      microMAf, microMAs, microRSI;
datetime lastTradeTime     = 0;
datetime lastTGTime        = 0;
datetime currentDay        = 0;
datetime lastDailyReport   = 0;
datetime lastBarTime       = 0;          // for NewBar gating
datetime lastEntryBarTime  = 0;          // bar time of last entry (min-bars gate)
bool     tradingEnabled    = true;
bool     rollbackMode      = false;
bool     circuitBreakerActive = false;
double   startBalance      = 0;
double   dayStartEquity    = 0;
double   lastBuyEntryPrice  = 0;
double   lastSellEntryPrice = 0;
double   basketPeakProfit   = 0;
double   lastClosedLot      = 0.01;
double   consecutiveLosses  = 0;

// Telegram session stats
datetime sessionStart       = 0;
int      tgDayTrades        = 0;
int      tgDayWins          = 0;
double   tgDayProfit        = 0.0;
double   tgBestTrade        = 0.0;
double   tgWorstTrade       = 0.0;
double   tgGrossProfit      = 0.0;
double   tgGrossLoss        = 0.0;
string   tgBatchBuffer      = "";
datetime tgBatchStartTime   = 0;

double   g_ATR_GridMultiplier;
double   g_GridLotMultiplier;
int      g_MaxGridLevelsPerSide;

enum RegimeType { TREND=0, RANGE=1, SPIKE=2 };
RegimeType currentRegime = TREND;

//================ DASHBOARD STATE =================
datetime lastDashboardPush = 0;

//================ SELF-LEARNING STATE =================
enum StrategyType { STRAT_TREND=0, STRAT_RANGE=1, STRAT_BREAKOUT=2 };

// Adaptive strategy per regime
struct RegimeStrategy
{
   StrategyType preferredStrategy;   // which strategy works best in this regime
   double       confidence;          // 0..1 how confident we are in current strategy
   double       tpUSD;               // learned take-profit in USD for this regime
   double       slUSD;               // learned stop-loss in USD for this regime
   double       emaFast;             // learned EMA fast period
   double       emaSlow;             // learned EMA slow period
};
RegimeStrategy regimeStrategy[3];

struct RegimeStat
{
   int    trades;
   int    wins;
   double profit;
   double riskMult;
   double gridMult;
   double lastAdaptScore;            // memory of last adaptation decision
};
RegimeStat learnStat[3];

// Per-strategy performance tracking (for strategy selection learning)
struct StratStat
{
   int    trades;
   int    wins;
   double profit;
};
StratStat stratStat[3][3];           // [regime][strategy]
datetime   lastLearnSave = 0;
int        lastDealRegime = 0;
int        lastDealStrategy = 0;

//================ INIT =================
int OnInit()
{
   trade.SetExpertMagicNumber((long)MagicNumber);

   startBalance   = AccountInfoDouble(ACCOUNT_BALANCE);
   dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   basketPeakProfit = 0;

   g_ATR_GridMultiplier = ATR_GridMultiplier;
   g_GridLotMultiplier  = GridLotMultiplier;
   g_MaxGridLevelsPerSide = MaxGridLevelsPerSide;

   atrH  = iATR(_Symbol,_Period,ATR_Period);
   adxH  = iADX(_Symbol,_Period,ADX_Period);
   emaF_H= iMA(_Symbol,_Period,EMA_Fast,0,MODE_EMA,PRICE_CLOSE);
   emaS_H= iMA(_Symbol,_Period,EMA_Slow,0,MODE_EMA,PRICE_CLOSE);
   rsiH  = iRSI(_Symbol,_Period,RSI_Period,PRICE_CLOSE);
   microMAf = iMA(_Symbol,_Period,MicroMA_Fast,0,MODE_EMA,PRICE_CLOSE);
   microMAs = iMA(_Symbol,_Period,MicroMA_Slow,0,MODE_EMA,PRICE_CLOSE);
   microRSI = iRSI(_Symbol,_Period,MicroRSI_Period,PRICE_CLOSE);

   if(atrH==INVALID_HANDLE || adxH==INVALID_HANDLE || emaF_H==INVALID_HANDLE ||
      emaS_H==INVALID_HANDLE || rsiH==INVALID_HANDLE ||
      microMAf==INVALID_HANDLE || microMAs==INVALID_HANDLE || microRSI==INVALID_HANDLE)
   {
      Print("Indicator handle creation failed.");
      return INIT_FAILED;
   }

   if(UseCSVLogger)
   {
      csvH = FileOpen(CSVFileName, FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI, ';');
      if(csvH != INVALID_HANDLE)
      {
         FileSeek(csvH, 0, SEEK_END);
         if(FileTell(csvH) == 0)
            FileWrite(csvH,"time","symbol","event","details","profit","volume",
                      "balance","equity","spread","regime","basket","ticket");
      }
      else
         Print("CSV open failed, error ",GetLastError());
   }

   LearningInit();
   if(UseSelfLearning) LoadLearning();

   MarkNewDay(true);
   TGStartup();
   DashboardHeartbeat();   // notify dashboard server that we're online
   Print("EA Started - High-Frequency Scalper v3.00");
   return INIT_SUCCEEDED;
}

//================ DEINIT =================
void OnDeinit(const int reason)
{
   if(atrH  !=INVALID_HANDLE) IndicatorRelease(atrH);
   if(adxH  !=INVALID_HANDLE) IndicatorRelease(adxH);
   if(emaF_H!=INVALID_HANDLE) IndicatorRelease(emaF_H);
   if(emaS_H!=INVALID_HANDLE) IndicatorRelease(emaS_H);
   if(rsiH  !=INVALID_HANDLE) IndicatorRelease(rsiH);
   if(microMAf!=INVALID_HANDLE) IndicatorRelease(microMAf);
   if(microMAs!=INVALID_HANDLE) IndicatorRelease(microMAs);
   if(microRSI!=INVALID_HANDLE) IndicatorRelease(microRSI);
   if(csvH  !=INVALID_HANDLE) FileClose(csvH);
   if(UseSelfLearning) SaveLearning();
   TGFlushBatch(true);
   TGShutdown(reason);
}

//================ INDICATORS =================
double B(int h)
{
   double a[];
   if(CopyBuffer(h,0,0,1,a)<=0) return EMPTY_VALUE;
   return a[0];
}
double ATR(){ return B(atrH);    }
double ADX(){ return B(adxH);    }
double EMAF(){ return B(emaF_H); }
double EMAS(){ return B(emaS_H); }
double RSI(){ return B(rsiH);    }
double MicroMAF(){ return B(microMAf); }
double MicroMAS(){ return B(microMAs); }
double MicroRSI(){ return B(microRSI); }

//================ REGIME =================
RegimeType DetectRegime()
{
   double adx = ADX();
   double atr = ATR();
   double diff= MathAbs(EMAF()-EMAS());

   if(adx==EMPTY_VALUE || atr==EMPTY_VALUE) return currentRegime;

   double atrPrev[]; if(CopyBuffer(atrH,0,1,1,atrPrev)>0 && atrPrev[0]>0)
   {
      if(atr >= atrPrev[0]*ATR_SPIKE_MULTIPLIER) return SPIKE;
   }

   if(adx < 15) return SPIKE;
   if(adx < ADX_Trend_Threshold && diff < atr*0.3) return RANGE;
   return TREND;
}

string RegimeName(RegimeType r)
{
   if(r==TREND) return "TREND";
   if(r==RANGE) return "RANGE";
   return "SPIKE";
}

void UpdateRegime()
{
   if(!UseRegimeAI) return;
   RegimeType r = DetectRegime();
   if(r != currentRegime)
   {
      currentRegime = r;
      if(r==TREND)
      {
         g_ATR_GridMultiplier = 1.2; g_GridLotMultiplier = 1.20; g_MaxGridLevelsPerSide = 6;
      }
      else if(r==RANGE)
      {
         g_ATR_GridMultiplier = 0.8; g_GridLotMultiplier = 1.30; g_MaxGridLevelsPerSide = 8;
      }
      else
      {
         g_ATR_GridMultiplier = 1.8; g_GridLotMultiplier = 1.10; g_MaxGridLevelsPerSide = 3;
      }
      Print("Regime -> ", RegimeName(r));
      TGRegimeChange(r);
   }
}

//================ TREND SCORE =================
double TrendScore()
{
   double ema_f = EMAF(), ema_s = EMAS(), atr = ATR(), rsi = RSI();
   if(ema_f==EMPTY_VALUE || ema_s==EMPTY_VALUE || atr==EMPTY_VALUE || rsi==EMPTY_VALUE)
      return 0;

   double score = 0;
   double gap = (ema_f - ema_s) / (atr + _Point);
   if(gap >  0.3) score += 0.5;
   if(gap < -0.3) score -= 0.5;
   if(rsi > 55) score += 0.5;
   if(rsi < 45) score -= 0.5;
   return score;
}

//================ SCALP SIGNAL =================
// Returns +1 = BUY, -1 = SELL, 0 = no trade
int ScalpSignal()
{
   double maf = MicroMAF(), mas = MicroMAS(), rsi = MicroRSI();
   if(maf==EMPTY_VALUE || mas==EMPTY_VALUE || rsi==EMPTY_VALUE) return 0;

   double score = 0;

   // Micro EMA crossover
   if(maf > mas) score += 1;
   else          score -= 1;

   // RSI extremes (mean-reversion scalp)
   if(rsi < RSI_Oversold)      score += 2;   // strong buy
   else if(rsi > RSI_Overbought) score -= 2; // strong sell
   else if(rsi < 45)           score += 1;
   else if(rsi > 55)           score -= 1;

   // Momentum confirmation
   double momClose[];
   if(CopyClose(_Symbol,_Period,0,MomentumBars+1,momClose) >= MomentumBars+1)
   {
      double mom = momClose[MomentumBars] - momClose[0];
      if(mom > 0) score += 1;
      else        score -= 1;
   }

   // Price action confirmation (last closed bar direction)
   if(RequirePriceAction)
   {
      double o[],h[],l[],c[];
      if(CopyOpen(_Symbol,_Period,1,1,o)>0 && CopyClose(_Symbol,_Period,1,1,c)>0)
      {
         bool bullBar = c[0] > o[0];
         if(score > 0 && !bullBar) score -= 1;
         if(score < 0 &&  bullBar) score += 1;
      }
   }

   // Stricter threshold (low-frequency): require stronger confirmation
   if(score >=  4) return  1;
   if(score <= -4) return -1;
   return 0;
}

//================ ADAPTIVE STRATEGY SIGNALS =================
// Each strategy produces its own signal. The EA picks the best one for the regime.

// STRATEGY 1: TREND FOLLOWING — trade in EMA direction, momentum-confirmed
int SignalTrend()
{
   double ema_f = EMAF(), ema_s = EMAS(), atr = ATR(), rsi = RSI(), adx = ADX();
   if(ema_f==EMPTY_VALUE || ema_s==EMPTY_VALUE || atr==EMPTY_VALUE || rsi==EMPTY_VALUE)
      return 0;

   double gap = (ema_f - ema_s) / (atr + _Point);
   int sig = 0;
   if(gap >  0.3 && rsi > 50) sig =  1;   // bullish trend
   if(gap < -0.3 && rsi < 50) sig = -1;   // bearish trend
   // Require trend strength
   if(adx!=EMPTY_VALUE && adx < 18) return 0;
   return sig;
}

// STRATEGY 2: RANGE / MEAN-REVERSION — fade RSI extremes against short-term overextension
int SignalRange()
{
   double rsi = MicroRSI();
   double maf = MicroMAF(), mas = MicroMAS();
   if(rsi==EMPTY_VALUE || maf==EMPTY_VALUE || mas==EMPTY_VALUE) return 0;

   // Buy oversold dips, sell overbought rips
   if(rsi < RSI_Oversold   && maf < mas) return  1;
   if(rsi > RSI_Overbought && maf > mas) return -1;
   return 0;
}

// STRATEGY 3: BREAKOUT — enter on volatility expansion after consolidation
int SignalBreakout()
{
   double atr = ATR(), adx = ADX();
   if(atr==EMPTY_VALUE || adx==EMPTY_VALUE) return 0;

   // Detect ATR spike (volatility expansion)
   double atrPrev[];
   if(CopyBuffer(atrH,0,1,1,atrPrev)<=0) return 0;
   if(atrPrev[0]<=0) return 0;
   bool expansion = (atr >= atrPrev[0] * 1.3);

   if(!expansion) return 0;

   // Direction from closed-bar breakout
   double h[], l[], c[];
   if(CopyHigh(_Symbol,_Period,1,3,h)<3 || CopyLow(_Symbol,_Period,1,3,l)<3) return 0;
   double hi = MathMax(h[0], MathMax(h[1], h[2]));
   double lo = MathMin(l[0], MathMin(l[1], l[2]));
   double price = SymbolInfoDouble(_Symbol,SYMBOL_BID);

   if(price > hi && adx > 20) return  1;   // upside breakout
   if(price < lo && adx > 20) return -1;   // downside breakout
   return 0;
}

// Pick the right strategy for the current regime (with learned preference)
StrategyType PreferredStrategy(const RegimeType regime)
{
   if(!UseAdaptiveStrategy)
   {
      // Static defaults
      if(regime==TREND) return STRAT_TREND;
      if(regime==RANGE) return STRAT_RANGE;
      return STRAT_BREAKOUT;
   }
   return regimeStrategy[(int)regime].preferredStrategy;
}

// Get learned TP/SL for the chosen strategy in current regime
void GetStratTPSL(const RegimeType regime, double &tpUSD, double &slUSD)
{
   int i = (int)regime;
   tpUSD = regimeStrategy[i].tpUSD;
   slUSD = regimeStrategy[i].slUSD;
   if(tpUSD <= 0 || slUSD <= 0)
   {
      // Fallback to input defaults per strategy type
      StrategyType s = regimeStrategy[i].preferredStrategy;
      if(s==STRAT_TREND)    { tpUSD = Trend_TP_USD;    slUSD = Trend_SL_USD; }
      else if(s==STRAT_RANGE){ tpUSD = Range_TP_USD;   slUSD = Range_SL_USD; }
      else                  { tpUSD = Breakout_TP_USD; slUSD = Breakout_SL_USD; }
   }
}

string StratName(const StrategyType s)
{
   if(s==STRAT_TREND)    return "TREND-FOLLOW";
   if(s==STRAT_RANGE)    return "MEAN-REVERT";
   return "BREAKOUT";
}

//================ POSITION HELPERS =================
int Count(int type)
{
   int c=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t))
      {
         if((ulong)PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
         if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
         if((int)PositionGetInteger(POSITION_TYPE)==type) c++;
      }
   }
   return c;
}

double BasketProfit()
{
   double p=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t))
         if((ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber &&
            PositionGetString(POSITION_SYMBOL)==_Symbol)
            p += PositionGetDouble(POSITION_PROFIT);
   }
   return p;
}

double NetExposure()
{
   double b=0,s=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t))
      {
         if((ulong)PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
         if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
         double vol = PositionGetDouble(POSITION_VOLUME);
         int type = (int)PositionGetInteger(POSITION_TYPE);
         if(type==POSITION_TYPE_BUY)  b+=vol;
         if(type==POSITION_TYPE_SELL) s+=vol;
      }
   }
   return MathAbs(b-s);
}

int TotalMine()
{
   int c=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t))
         if((ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber &&
            PositionGetString(POSITION_SYMBOL)==_Symbol) c++;
   }
   return c;
}

//================ LOT =================
double CalcLot(double multiplier = 1.0)
{
   double lot = MicroLots;

   // Martingale micro: bump lot after consecutive losses
   if(UseMartingaleMicro && consecutiveLosses > 0)
      lot = lastClosedLot * MathPow(MartingaleMult, consecutiveLosses);
   lot *= multiplier;

   if(UseSelfLearning)
      lot *= learnStat[(int)currentRegime].riskMult;

   double minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step  =SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(step<=0) step=0.01;

   // Cap martingale growth
   lot = MathMin(lot, MartingaleMaxLots);

   lot = MathMax(minLot, MathMin(maxLot, lot));
   lot = MathFloor(lot/step)*step;
   lot = NormalizeDouble(lot,2);
   return lot;
}

//================ CSV LOGGER =================
void LogCSV(const string event,const string details,const double profit,
            const double volume,const ulong ticket=0)
{
   if(!UseCSVLogger || csvH==INVALID_HANDLE) return;
   FileWrite(csvH,
      TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS),
      _Symbol,
      event,
      details,
      DoubleToString(profit,2),
      DoubleToString(volume,2),
      DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2),
      DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2),
      IntegerToString((int)SymbolInfoInteger(_Symbol,SYMBOL_SPREAD)),
      RegimeName(currentRegime),
      DoubleToString(BasketProfit(),2),
      IntegerToString((long)ticket));
   FileFlush(csvH);
}

//================ TELEGRAM PROFESSIONAL ENGINE =================
// Emoji map (toggleable via TelegramEmojiSafe)
string EMO(string e){ return TelegramEmojiSafe ? e : ""; }
string DIR_BUY (){ return EMO("🟢 BUY ");  }
string DIR_SELL(){ return EMO("🔴 SELL "); }

// Bar: draw a text progress bar using blocks
string Bar(const double value,const double maxv,const int width=12)
{
   string s=""; if(maxv<=0) return s;
   int filled=(int)MathRound((value/maxv)*width);
   if(filled<0) filled=0; if(filled>width) filled=width;
   for(int i=0;i<width;i++) s += (i<filled) ? "█" : "░";
   return s;
}

string UrlEncode(const string text)
{
   string out="";
   uchar ch[];
   StringToCharArray(text,ch,0,StringLen(text));
   for(int i=0;i<ArraySize(ch)-1;i++)
   {
      uchar c=ch[i];
      if((c>='0'&&c<='9')||(c>='A'&&c<='Z')||(c>='a'&&c<='z')||c=='-'||c=='_'||c=='.'||c=='~')
         out+=CharToString(c);
      else
         out+="%"+StringFormat("%02X",c);
   }
   return out;
}

// Raw HTTP send (no formatting). Returns true on success.
bool TGSend(const string msg,const bool isHTML=true)
{
   if(!UseTelegram) return false;
   if(TelegramToken=="" || TelegramChatID=="") return false;
   if(TimeCurrent()-lastTGTime < TelegramCooldownSec) return false;

   string mode = (TelegramUseHTML && isHTML) ? "HTML" : "";
   string url  = "https://api.telegram.org/bot"+TelegramToken+"/sendMessage";
   string body = "chat_id="+UrlEncode(TelegramChatID)+
                 "&text="+UrlEncode(msg);
   if(mode!="") body += "&parse_mode="+mode;
   body += "&disable_web_page_preview=true";

   char data[],result[];
   string headers="Content-Type: application/x-www-form-urlencoded\r\n";
   StringToCharArray(body,data,0,StringLen(body));

   ResetLastError();
   bool ok = WebRequest("POST",url,headers,5000,data,result);
   lastTGTime = TimeCurrent();
   if(!ok)
   {
      int err=GetLastError();
      Print("Telegram WebRequest failed (",err,
            "). Add URL to Tools > Options > Expert Advisors > Allow WebRequest.");
   }
   return ok;
}

// Notify() — keep backward-compatible entry point.
// If HTML is on, it sends as-is (caller must format). Else it strips simple tags.
void Notify(const string msg)
{
   if(!TelegramUseHTML) { TGSend(msg,false); return; }
   TGSend(msg, true);
}

//============= DASHBOARD PUSH (Live Web Server) =============
// Builds a JSON snapshot of the current bot/account state and POSTs it to the
// dashboard server's /api/update endpoint. The server authenticates via the
// X-Auth-Token header (must match AUTH_TOKEN in the server's .env).

// Escape a string for JSON output
string JsonEsc(const string s)
{
   string out = "";
   int n = StringLen(s);
   for(int i=0; i<n; i++)
   {
      ushort c = StringGetCharacter(s,i);
      if     (c == '\"') out += "\\\"";
      else if(c == '\\') out += "\\\\";
      else if(c == '\n') out += "\\n";
      else if(c == '\r') out += "\\r";
      else if(c == '\t') out += "\\t";
      else if(c < 32)    out += " ";          // strip other control chars
      else               out += ShortToString(c);
   }
   return out;
}

// Build the JSON body for /api/update
string DashboardBuildPayload()
{
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double profit   = AccountInfoDouble(ACCOUNT_PROFIT);
   double margin   = AccountInfoDouble(ACCOUNT_MARGIN);
   double mFree    = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double mLevel   = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   string ccy      = AccountInfoString(ACCOUNT_CURRENCY);
   string broker   = AccountInfoString(ACCOUNT_COMPANY);
   long   login    = AccountInfoInteger(ACCOUNT_LOGIN);
   string server   = AccountInfoString(ACCOUNT_SERVER);
   long   leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);

   int total = PositionsTotal();
   int wins  = 0, losses = 0;
   double grossProfit = 0, grossLoss = 0;

   // Open positions array
   string posArr = "";
   for(int i=0; i<total; i++)
   {
      ulong tk = PositionGetTicket(i);
      if(!PositionSelectByTicket(tk)) continue;

      double p = PositionGetDouble(POSITION_PROFIT)
               + PositionGetDouble(POSITION_SWAP)
               + PositionGetDouble(POSITION_COMMISSION);
      if(p >= 0) { wins++; grossProfit += p; }
      else       { losses++; grossLoss += p; }

      string sym   = PositionGetString(POSITION_SYMBOL);
      long   type  = PositionGetInteger(POSITION_TYPE);
      double vol   = PositionGetDouble(POSITION_VOLUME);
      double open  = PositionGetDouble(POSITION_PRICE_OPEN);
      double cur   = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl    = PositionGetDouble(POSITION_SL);
      double tp    = PositionGetDouble(POSITION_TP);
      long   mSec  = (long)((datetime)PositionGetInteger(POSITION_TIME));

      string tag   = "";
      if(PositionGetString(POSITION_COMMENT) != "") tag = PositionGetString(POSITION_COMMENT);

      string ps = "{";
      ps += "\"ticket\":"+IntegerToString((long)tk)+",";
      ps += "\"symbol\":\""+JsonEsc(sym)+"\",";
      ps += "\"type\":"+(type==POSITION_TYPE_BUY?"\"buy\"":"\"sell\"")+",";
      ps += "\"volume\":"+DoubleToString(vol,2)+",";
      ps += "\"open\":"+DoubleToString(open,(int)SymbolInfoInteger(sym,SYMBOL_DIGITS))+",";
      ps += "\"current\":"+DoubleToString(cur,(int)SymbolInfoInteger(sym,SYMBOL_DIGITS))+",";
      ps += "\"sl\":"+DoubleToString(sl,(int)SymbolInfoInteger(sym,SYMBOL_DIGITS))+",";
      ps += "\"tp\":"+DoubleToString(tp,(int)SymbolInfoInteger(sym,SYMBOL_DIGITS))+",";
      ps += "\"profit\":"+DoubleToString(p,2)+",";
      ps += "\"tag\":\""+JsonEsc(tag)+"\",";
      ps += "\"time\":"+IntegerToString(mSec);
      ps += "}";
      if(posArr != "") posArr += ",";
      posArr += ps;
   }
   posArr = "[" + posArr + "]";

   // Latest candle (the chart symbol)
   string candle = "{}";
   if(SeriesInfoInteger(_Symbol,_Period,SERIES_BARS_COUNT) > 0)
   {
      double o = iOpen(_Symbol,_Period,0);
      double h = iHigh(_Symbol,_Period,0);
      double l = iLow(_Symbol,_Period,0);
      double c = iClose(_Symbol,_Period,0);
      long   t = (long)iTime(_Symbol,_Period,0);
      int dg = (int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS);
      candle = "{\"time\":"+IntegerToString(t)
             + ",\"open\":"+DoubleToString(o,dg)
             + ",\"high\":"+DoubleToString(h,dg)
             + ",\"low\":"+DoubleToString(l,dg)
             + ",\"close\":"+DoubleToString(c,dg)+"}";
   }

   // Regime / strategy names
   string regimeStr = "trend";
   if(currentRegime == RANGE) regimeStr = "range";
   if(currentRegime == SPIKE) regimeStr = "spike";

   string body = "{";
   // bot block
   body += "\"bot\":{";
   body +=   "\"name\":\""+JsonEsc(BotName)+"\",";
   body +=   "\"symbol\":\""+JsonEsc(_Symbol)+"\",";
   body +=   "\"magic\":"+IntegerToString((long)MagicNumber)+",";
   body +=   "\"regime\":\""+regimeStr+"\",";
   body +=   "\"uptime\":"+IntegerToString((long)(TimeCurrent()-0))+",";
   body +=   "\"lastUpdate\":"+IntegerToString((long)TimeCurrent())+",";
   body +=   "\"currency\":\""+JsonEsc(ccy)+"\",";
   body +=   "\"broker\":\""+JsonEsc(broker)+"\"";
   body += "},";
   // account block
   body += "\"account\":{";
   body +=   "\"balance\":"+DoubleToString(balance,2)+",";
   body +=   "\"equity\":"+DoubleToString(equity,2)+",";
   body +=   "\"profit\":"+DoubleToString(profit,2)+",";
   body +=   "\"margin\":"+DoubleToString(margin,2)+",";
   body +=   "\"freeMargin\":"+DoubleToString(mFree,2)+",";
   body +=   "\"marginLevel\":"+(mLevel>0?DoubleToString(mLevel,2):"0")+",";
   body +=   "\"leverage\":"+IntegerToString(leverage)+",";
   body +=   "\"login\":"+IntegerToString(login)+",";
   body +=   "\"server\":\""+JsonEsc(server)+"\",";
   body +=   "\"currency\":\""+JsonEsc(ccy)+"\"";
   body += "},";
   // positions
   body += "\"positions\":"+posArr+",";
   // candle
   body += "\"candle\":"+candle+",";
   // stats block
   body += "\"stats\":{";
   body +=   "\"openPositions\":"+IntegerToString(total)+",";
   body +=   "\"winningPositions\":"+IntegerToString(wins)+",";
   body +=   "\"losingPositions\":"+IntegerToString(losses)+",";
   body +=   "\"grossProfit\":"+DoubleToString(grossProfit,2)+",";
   body +=   "\"grossLoss\":"+DoubleToString(grossLoss,2)+",";
   body +=   "\"startBalance\":"+DoubleToString(startBalance,2)+",";
   body +=   "\"dayStartEquity\":"+DoubleToString(dayStartEquity,2);
   body += "},";
   // learning/regime/strategy (lightweight, server merges)
   body += "\"learning\":{\"enabled\":"+(UseSelfLearning?"true":"false")+"},";
   body += "\"regime\":\""+regimeStr+"\"";
   body += "}";

   return body;
}

// POST the snapshot to the dashboard server. Returns true on HTTP 200.
bool DashboardSend(const string payload)
{
   if(!UseDashboard || DashboardMode == 0) return false;
   if(DashboardURL == "" || DashboardToken == "") return false;

   string url = DashboardURL;
   // ensure no trailing slash
   if(StringGetCharacter(url, StringLen(url)-1) == '/')
      url = StringSubstr(url, 0, StringLen(url)-1);
   url += "/api/update";

   char   data[];
   char   result[];
   string resultHeaders;

   StringToCharArray(payload, data, 0, StringLen(payload));
   // StringToCharArray appends a null terminator; trim it
   int realLen = ArraySize(data);
   if(realLen > 0 && data[realLen-1] == 0) ArrayResize(data, realLen-1);

   string headers = "Content-Type: application/json\r\n";
   headers += "X-Auth-Token: " + DashboardToken + "\r\n";

   ResetLastError();
   int timeout = 5000;
   bool ok = WebRequest("POST", url, headers, timeout, data, result, resultHeaders);
   if(!ok)
   {
      int err = GetLastError();
      Print("Dashboard WebRequest failed (", err,
            "). Add URL to Tools > Options > Expert Advisors > Allow WebRequest: ",
            DashboardURL);
      return false;
   }

   // Check HTTP status line for 200
   string resp = CharArrayToString(result);
   if(StringFind(resp, "\"ok\":true") < 0 && StringFind(resp, "\"ok\": true") < 0)
   {
      // Non-fatal: server may still have accepted it. Log for debugging.
      Print("Dashboard response: ", StringSubstr(resp, 0, 200));
   }
   return true;
}

// Public entry: builds + sends the snapshot (throttled by caller)
void DashboardPush()
{
   if(!UseDashboard || DashboardMode == 0) return;
   string payload = DashboardBuildPayload();
   DashboardSend(payload);
}

// Heartbeat ping — call once at startup so the server marks the bot online ASAP
void DashboardHeartbeat()
{
   if(!UseDashboard || DashboardMode == 0) return;
   if(DashboardURL == "" || DashboardToken == "") return;

   string url = DashboardURL;
   if(StringGetCharacter(url, StringLen(url)-1) == '/')
      url = StringSubstr(url, 0, StringLen(url)-1);
   url += "/api/heartbeat";

   char   data[];
   char   result[];
   string resultHeaders;
   string payload = "{\"uptime\":" + IntegerToString((long)1) + "}";
   StringToCharArray(payload, data, 0, StringLen(payload));
   int n = ArraySize(data);
   if(n > 0 && data[n-1] == 0) ArrayResize(data, n-1);

   string headers = "Content-Type: application/json\r\n";
   headers += "X-Auth-Token: " + DashboardToken + "\r\n";

   WebRequest("POST", url, headers, 5000, data, result, resultHeaders);
}

//============= FORMATTED MESSAGE BUILDERS =============

// Professional header line with brand + symbol + time
string TGHeader(const string title)
{
   string line = "";
   if(TelegramEmojiSafe) line += "━━━━━━━━━━━━━\n";
   if(TelegramUseHTML) line += "<b>"+BotName+"</b> "+EMO("📊")+" <code>"+_Symbol+"</code>";
   else                 line += BotName+" "+_Symbol;
   line += " " + EMO("⏱") + " " + TimeToString(TimeCurrent(),TIME_DATE|TIME_MINUTES);
   line += "\n<i>"+title+"</i>\n";
   if(TelegramEmojiSafe) line += "━━━━━━━━━━━━━\n";
   return line;
}

// NEW TRADE OPENED
void TGTradeOpen(const bool buy, const double lot, const double price, const string reason)
{
   if(!TGNotifyOpen) return;
   if(!UseTelegram) return;

   string dir = buy ? DIR_BUY() : DIR_SELL();
   string msg = TGHeader("NEW TRADE OPENED") ;
   if(TelegramUseHTML)
      msg += dir + " | lot <b>" + DoubleToString(lot,2) + "</b>\n";
   else
      msg += dir + " | lot " + DoubleToString(lot,2) + "\n";
   msg += EMO("💵") + " Price: <code>" + DoubleToString(price,_Digits) + "</code>\n";
   msg += EMO("🎯") + " Trigger: <i>" + reason + "</i>\n";
   msg += EMO("📈") + " Regime: <b>" + RegimeName(currentRegime) + "</b>\n";
   msg += EMO("🧮") + " Open: "+IntegerToString(Count(POSITION_TYPE_BUY))+"B / "+
          IntegerToString(Count(POSITION_TYPE_SELL))+"S";
   Notify(msg);
}

// TRADE CLOSED with P/L
void TGTradeClose(const bool buy, const double lot, const double profit,
                  const string reason)
{
   tgDayTrades++;
   tgDayProfit += profit;
   if(profit > 0){ tgDayWins++; tgGrossProfit += profit; if(profit>tgBestTrade) tgBestTrade=profit; }
   else          { tgGrossLoss  += MathAbs(profit); if(profit<tgWorstTrade) tgWorstTrade=profit; }

   if(!TGNotifyClose) return;
   if(!UseTelegram) return;

   string dir = buy ? DIR_BUY() : DIR_SELL();
   string plIcon = profit >= 0 ? EMO("✅") : EMO("❌");
   string plColor;
   if(TelegramUseHTML)
      plColor = (profit >= 0) ? "<b>" : "<b>";
   else
      plColor = "";

   string msg = TGHeader("TRADE CLOSED");
   msg += dir + " | lot " + DoubleToString(lot,2) + "\n";
   if(TelegramUseHTML)
      msg += plIcon + " P/L: <b>" + (profit>=0?"+":"") + DoubleToString(profit,2) + " USD</b>\n";
   else
      msg += plIcon + " P/L: " + (profit>=0?"+":"") + DoubleToString(profit,2) + " USD\n";
   msg += EMO("🎯") + " Reason: <i>" + reason + "</i>\n";
   // Day running stats
   msg += EMO("📅") + " Day: " + IntegerToString(tgDayTrades) + " trades | " +
          (tgDayProfit>=0?"+":"") + DoubleToString(tgDayProfit,2) + " USD";
   Notify(msg);
}

// Regime change notification
void TGRegimeChange(const RegimeType newRegime)
{
   if(!TGNotifyRegime) return;
   if(!UseTelegram) return;

   string icon;
   if(newRegime==TREND) icon = EMO("🚀");
   else if(newRegime==RANGE) icon = EMO("🎯");
   else                      icon = EMO("⚡");

   string msg = TGHeader("MARKET REGIME CHANGE");
   msg += EMO("🧭") + " New regime: <b>" + icon + " " + RegimeName(newRegime) + "</b>\n";
   msg += EMO("📐") + " Grid spacing multiplier adapted\n";
   msg += EMO("🤖") + " Self-learning re-tuned for " + RegimeName(newRegime);
   Notify(msg);
}

// Risk event (drawdown / recovery)
void TGRiskEvent(const string event, const double value)
{
   if(!TGNotifyRisk) return;
   if(!UseTelegram) return;

   string msg = TGHeader("RISK EVENT " + EMO("🛡️"));
   if(TelegramUseHTML)
      msg += "⚠️ <b>" + event + "</b>\n";
   else
      msg += "WARNING: " + event + "\n";
   msg += EMO("📉") + " Drawdown: <b>" + DoubleToString(value,2) + "%</b>\n";
   msg += EMO("💰") + " Equity: <code>" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2) + " USD</code>\n";
   msg += EMO("🔒") + " Trading " + (rollbackMode ? "<b>PAUSED</b>" : "RESUMED");
   Notify(msg);
}

// BATCH SUMMARY: send accumulated trade lines in one professional card
void TGFlushBatch(const bool force=false)
{
   if(!UseTelegram || !TGBatchTrades) return;
   if(tgBatchBuffer=="" && !force) return;
   if(!force && TimeCurrent()-tgBatchStartTime < TGBatchWindowSec) return;

   if(tgBatchBuffer=="") return;

   string msg = TGHeader("TRADE BATCH SUMMARY " + EMO("📦"));
   msg += tgBatchBuffer;
   // Running tally
   msg += "\n" + EMO("Σ") + " Total: " + IntegerToString(tgDayTrades) + " | Net <b>" +
          (tgDayProfit>=0?"+":"") + DoubleToString(tgDayProfit,2) + " USD</b>";
   TGSend(msg, true);
   tgBatchBuffer = "";
}

// Append a single line to the batch buffer
void TGBatchAdd(const bool buy, const double lot, const double profit, const string reason)
{
   if(!UseTelegram || !TGBatchTrades) return;
   if(tgBatchBuffer=="") tgBatchStartTime = TimeCurrent();

   string dir = buy ? DIR_BUY() : DIR_SELL();
   string line = dir + DoubleToString(lot,2) + " | " +
                 (profit>=0?"+":"") + DoubleToString(profit,2) + " | " + reason + "\n";
   tgBatchBuffer += line;

   if(StringLen(tgBatchBuffer) > 1500) TGFlushBatch(true);
}

// Daily report — full professional dashboard
void DailyReport()
{
   if(!UseTelegram) return;

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   double pnl = eq - dayStartEquity;
   double winRate = (tgDayTrades>0) ? (double)tgDayWins/tgDayTrades*100.0 : 0;
   double profitFactor = (tgGrossLoss>0) ? tgGrossProfit/tgGrossLoss : (tgGrossProfit>0?99:0);

   string msg = TGHeader("DAILY REPORT " + EMO("📋"));
   msg += EMO("💰") + " Balance: <code>" + DoubleToString(bal,2) + "</code>\n";
   msg += EMO("📈") + " Equity:  <code>" + DoubleToString(eq,2) + "</code>\n";
   msg += EMO("📅") + " Day P/L: <b>" + (pnl>=0?"+":"") + DoubleToString(pnl,2) + "</b> USD\n";
   msg += "\n";
   // Win rate bar
   if(TelegramUseHTML)
      msg += EMO("🎯") + " Win Rate: <b>" + DoubleToString(winRate,1) + "%</b>\n";
   else
      msg += "Win Rate: " + DoubleToString(winRate,1) + "%\n";
   msg += "        <code>" + Bar(winRate,100,16) + "</code>\n";
   msg += "\n";
   msg += EMO("📊") + " Trades: " + IntegerToString(tgDayTrades) + "\n";
   msg += EMO("🟩") + " Wins: " + IntegerToString(tgDayWins) +
          " | " + EMO("🟥") + " Losses: " + IntegerToString(tgDayTrades-tgDayWins) + "\n";
   msg += EMO("🏆") + " Best:  <b>" + DoubleToString(tgBestTrade,2) + "</b>\n";
   msg += EMO("💀") + " Worst: <b>" + DoubleToString(tgWorstTrade,2) + "</b>\n";
   msg += EMO("⚖️") + " Profit Factor: <b>" + DoubleToString(profitFactor,2) + "</b>\n";
   msg += "\n";
   msg += EMO("🧭") + " Current Regime: <b>" + RegimeName(currentRegime) + "</b>\n";
   msg += EMO("🧠") + " Strategy: <b>" + StratName(regimeStrategy[(int)currentRegime].preferredStrategy) + "</b>" +
          " (conf " + DoubleToString(regimeStrategy[(int)currentRegime].confidence*100,0) + "%)\n";
   msg += EMO("🧮") + " Open: " + IntegerToString(Count(POSITION_TYPE_BUY)) + "B / " +
          IntegerToString(Count(POSITION_TYPE_SELL)) + "S";

   Notify(msg);
   LogCSV("REPORT","daily",pnl,0);
}

// Start / Stop messages
void TGStartup()
{
   if(!UseTelegram) return;
   sessionStart = TimeCurrent();
   string msg = TGHeader("EA STARTED " + EMO("🟢"));
   msg += EMO("🤖") + " Bot: <b>" + BotName + "</b>\n";
   msg += EMO("💹") + " Symbol: <code>" + _Symbol + "</code>\n";
   msg += EMO("💵") + " Start Balance: <code>" + DoubleToString(startBalance,2) + " USD</code>\n";
   msg += EMO("🧠") + " Self-Learning: " + (UseSelfLearning?"<b>ON</b>":"OFF") + "\n";
   msg += EMO("🛡️") + " Max DD: <code>" + DoubleToString(MaxDrawdownPercent,1) + "%</code>";
   Notify(msg);
}

void TGShutdown(const int reason)
{
   if(!UseTelegram) return;
   string msg = TGHeader("EA STOPPED " + EMO("🛑"));
   msg += EMO("📴") + " Reason code: <code>" + IntegerToString(reason) + "</code>\n";
   double dur = (double)(TimeCurrent()-sessionStart)/3600.0;
   msg += EMO("⏱") + " Uptime: <code>" + DoubleToString(dur,1) + " hours</code>\n";
   msg += EMO("📊") + " Trades this session: " + IntegerToString(tgDayTrades);
   Notify(msg);
}

//================ DAY ROLLOVER =================
void MarkNewDay(const bool force=false)
{
   MqlDateTime mdt;
   TimeToStruct(TimeCurrent(),mdt);
   mdt.hour=0; mdt.min=0; mdt.sec=0;
   datetime today = StructToTime(mdt);

   if(force || today!=currentDay)
   {
      // New trading day: flush pending messages, then reset daily counters
      if(!force && currentDay!=0) TGFlushBatch(true);
      currentDay     = today;
      dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      tgDayTrades    = 0;
      tgDayWins      = 0;
      tgDayProfit    = 0.0;
      tgBestTrade    = 0.0;
      tgWorstTrade   = 0.0;
      tgGrossProfit  = 0.0;
      tgGrossLoss    = 0.0;
   }
}

//================ SCALP OPEN =================
void OpenScalp(bool buy, string reason, double tpUSDOverride=0, double slUSDOverride=0)
{
   if(!tradingEnabled || rollbackMode || circuitBreakerActive) return;
   if(!UseScalping) return;
   if((int)SymbolInfoInteger(_Symbol,SYMBOL_SPREAD) > MaxSpreadPoints) return;
   if(TimeCurrent()-lastTradeTime < ScalpCooldownSec) return;
   if(NetExposure() > MaxNetExposureLots) return;
   if(TotalMine() >= MaxScalpPositions) return;

   // LOW-FREQUENCY GATES
   // 1) Min bars between entries (avoid clustering on same bar/within few bars)
   if(MinBarsBetweenTrades > 0 && lastEntryBarTime != 0)
   {
      datetime curBar = (datetime)SeriesInfoInteger(_Symbol,_Period,SERIES_LASTBAR_DATE);
      int barsSince = (int)((curBar - lastEntryBarTime) / PeriodSeconds(_Period));
      if(barsSince < MinBarsBetweenTrades) return;
   }
   // 2) Min price distance from last entry (in ATR units) to avoid stacking too close
   if(MinPriceDistanceATR > 0)
   {
      double atr = ATR();
      double refPrice = buy ? lastBuyEntryPrice : lastSellEntryPrice;
      if(atr != EMPTY_VALUE && atr > 0 && refPrice > 0)
      {
         double price = buy ? SymbolInfoDouble(_Symbol,SYMBOL_ASK)
                            : SymbolInfoDouble(_Symbol,SYMBOL_BID);
         double dist = MathAbs(price - refPrice);
         if(dist < atr * MinPriceDistanceATR) return;
      }
   }

   int side = buy ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;
   if(Count(side) >= MaxScalpPerSide) return;

   // Hedge gate: if hedge disabled, don't open opposite to existing positions
   if(!AllowHedge && TotalMine() > 0)
   {
      bool hasOpposite = false;
      for(int i=PositionsTotal()-1;i>=0;i--)
      {
         ulong t=PositionGetTicket(i);
         if(PositionSelectByTicket(t))
            if((ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber &&
               PositionGetString(POSITION_SYMBOL)==_Symbol)
               if((int)PositionGetInteger(POSITION_TYPE)!=side) hasOpposite=true;
      }
      if(hasOpposite) return;
   }

   double lot = CalcLot();
   if(lot <= 0) return;

   double price = buy ? SymbolInfoDouble(_Symbol,SYMBOL_ASK)
                      : SymbolInfoDouble(_Symbol,SYMBOL_BID);

   // Determine TP/SL: strategy override > learned values > input points
   double tp=0, sl=0;
   double tpUSD = tpUSDOverride, slUSD = slUSDOverride;
   if(tpUSD<=0 || slUSD<=0)
   {
      double ltp=0, lsl=0;
      GetStratTPSL(currentRegime, ltp, lsl);
      tpUSD = ltp; slUSD = lsl;
   }

   if(tpUSD > 0 && slUSD > 0)
   {
      // Convert USD targets to price distance via tick value
      double tickVal = SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
      double tickSz  = SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
      double perPointPerLot = (tickSz>0) ? tickVal * (_Point/tickSz) : 0;
      if(perPointPerLot > 0)
      {
         double tpPoints = tpUSD / (perPointPerLot * lot);
         double slPoints = slUSD / (perPointPerLot * lot);
         tp = buy ? price + tpPoints*_Point : price - tpPoints*_Point;
         sl = buy ? price - slPoints*_Point : price + slPoints*_Point;
      }
   }

   // Fallback to points-based TP/SL if USD conversion failed
   if(tp==0 && ScalpTP_Points>0)
      tp = buy ? price + ScalpTP_Points*_Point : price - ScalpTP_Points*_Point;
   if(sl==0 && ScalpSL_Points>0)
      sl = buy ? price - ScalpSL_Points*_Point : price + ScalpSL_Points*_Point;

   bool ok;
   if(tp>0 && sl>0) ok = (buy ? trade.Buy(lot,_Symbol,price,sl,tp)
                              : trade.Sell(lot,_Symbol,price,sl,tp));
   else if(tp>0)    ok = (buy ? trade.Buy(lot,_Symbol,price,0,tp)
                              : trade.Sell(lot,_Symbol,price,0,tp));
   else             ok = (buy ? trade.Buy(lot,_Symbol) : trade.Sell(lot,_Symbol));

   if(ok)
   {
      lastTradeTime = TimeCurrent();
      lastEntryBarTime = (datetime)SeriesInfoInteger(_Symbol,_Period,SERIES_LASTBAR_DATE);
      ulong ticket = trade.ResultOrder();
      double fillPrice = trade.ResultPrice();
      if(buy)  lastBuyEntryPrice  = fillPrice;
      else     lastSellEntryPrice = fillPrice;
      Print("SCALP ",buy?"BUY":"SELL"," ",lot," (",reason,")");
      LogCSV("SCALP",reason,0,lot,ticket);
      TGTradeOpen(buy, lot, fillPrice, reason);
   }
   else
   {
      Print("Scalp order failed: ",trade.ResultRetcode()," ",trade.ResultComment());
   }
}

//================ MICRO TAKE-PROFIT (USD-based) =================
// Close any single position that hit the small USD profit target
void ManageMicroTP()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;

      double profit = PositionGetDouble(POSITION_PROFIT)
                    + PositionGetDouble(POSITION_SWAP);
      double vol = PositionGetDouble(POSITION_VOLUME);

      // Small profit target -> realize gain
      if(profit >= MicroTP_USD)
      {
         if(trade.PositionClose(t))
         {
            LogCSV("MICROTP","close",profit,vol,t);
            lastClosedLot = vol;
            consecutiveLosses = 0;
            bool buySide = ((int)PositionGetInteger(POSITION_TYPE))==POSITION_TYPE_BUY;
            // store type before context lost
            int ptype = (int)PositionGetInteger(POSITION_TYPE);
            bool wasBuy = (ptype==POSITION_TYPE_BUY);
            if(TGBatchTrades) TGBatchAdd(wasBuy, vol, profit, "micro-TP");
            else              TGTradeClose(wasBuy, vol, profit, "micro-TP");
         }
         continue;
      }
      // Emergency stop per trade
      if(profit <= -MicroSL_USD)
      {
         if(trade.PositionClose(t))
         {
            LogCSV("MICROSL","stop",profit,vol,t);
            lastClosedLot = vol;
            consecutiveLosses++;
            int ptype = (int)PositionGetInteger(POSITION_TYPE);
            bool wasBuy = (ptype==POSITION_TYPE_BUY);
            if(TGBatchTrades) TGBatchAdd(wasBuy, vol, profit, "micro-SL");
            else              TGTradeClose(wasBuy, vol, profit, "micro-SL");
         }
      }
   }
}

//================ GRID =================
void ManageGrid()
{
   if(!UseSmartGrid) return;

   double atr = ATR();
   if(atr==EMPTY_VALUE || atr<=0) return;

   double spacing = atr * g_ATR_GridMultiplier;
   double adx = ADX();
   if(adx!=EMPTY_VALUE && adx >= ADX_Trend_Threshold)
      spacing *= Grid_ExpandVolatility / 2.0;

   if(UseSelfLearning)
      spacing *= learnStat[(int)currentRegime].gridMult;

   double bid = SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol,SYMBOL_ASK);

   int buys  = Count(POSITION_TYPE_BUY);
   int sells = Count(POSITION_TYPE_SELL);

   // Add to winning side on pullback (tight grid => many entries)
   if(buys < g_MaxGridLevelsPerSide && buys > 0)
   {
      if(ask <= lastBuyEntryPrice - spacing)
         OpenScalp(true,"grid");
   }
   if(sells < g_MaxGridLevelsPerSide && sells > 0)
   {
      if(bid >= lastSellEntryPrice + spacing)
         OpenScalp(false,"grid");
   }
}

//================ BASKET =================
void CloseAllPositions()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t))
         if((ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber &&
            PositionGetString(POSITION_SYMBOL)==_Symbol)
            trade.PositionClose(t);
   }
}

void ManageBasket()
{
   if(!UseBasketManager) return;

   double p = BasketProfit();

   if(p > basketPeakProfit) basketPeakProfit = p;

   if(p >= BasketProfitTargetUSD)
   {
      CloseAllPositions();
      basketPeakProfit = 0;
      consecutiveLosses = 0;
      LogCSV("BASKET","profit target",p,0);
      Notify(TGHeader("BASKET CLOSED "+EMO("🟢")) +
             EMO("✅")+" Target hit\n" + EMO("💰")+" Profit: <b>+" +
             DoubleToString(p,2) + " USD</b>");
      Print("BASKET CLOSED @ ",p);
      return;
   }

   if(p <= -MathAbs(MaxBasketDrawdownUSD))
   {
      CloseAllPositions();
      basketPeakProfit = 0;
      LogCSV("BASKET","drawdown stop",p,0);
      Notify(TGHeader("BASKET STOP "+EMO("🛑")) +
             EMO("❌")+" Max drawdown hit\n" + EMO("📉")+" Loss: <b>" +
             DoubleToString(p,2) + " USD</b>");
      Print("BASKET STOP @ ",p);
      return;
   }

   if(basketPeakProfit >= BasketTrailStartUSD &&
      p <= basketPeakProfit - BasketTrailStepUSD)
   {
      CloseAllPositions();
      basketPeakProfit = 0;
      LogCSV("BASKET","trailing stop",p,0);
      Notify(TGHeader("BASKET TRAIL "+EMO("📍")) +
             EMO("🔒")+" Trailing stop\n" + EMO("💰")+" Realized: <b>" +
             DoubleToString(p,2) + " USD</b>\n" + EMO("🔺")+" Peak was: <code>" +
             DoubleToString(basketPeakProfit,2) + "</code>");
      Print("BASKET TRAIL @ ",p);
      return;
   }

   if(BasketHalfClosePercent>0 && p >= BasketProfitTargetUSD*BasketHalfClosePercent/100.0)
   {
      HalfCloseBasket();
      basketPeakProfit = 0;
   }
}

void HalfCloseBasket()
{
   int closed=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t))
      {
         if((ulong)PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
         if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
         double vol = PositionGetDouble(POSITION_VOLUME);
         double minLot = SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
         double half  = NormalizeDouble(vol/2.0,2);
         if(half >= minLot)
         {
            if(trade.PositionClosePartial(t,half)) closed++;
         }
      }
   }
   if(closed>0) LogCSV("BASKET","half close",0,closed);
}

//================ RISK =================
bool Risk()
{
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);

   if(rollbackMode)
   {
      double ddPct = (dayStartEquity-eq)/dayStartEquity*100.0;
      if(ddPct <= RecoveryThresholdPercent)
      {
         rollbackMode = false;
         Print("Recovery achieved, trading resumed.");
         TGRiskEvent("RECOVERY", -ddPct);
      }
   }

   if(!rollbackMode)
   {
      double ddPct = (bal-eq)/bal*100.0;
      if(ddPct >= MaxDrawdownPercent)
      {
         rollbackMode = true;
         ManageBasket();
         circuitBreakerActive = false;
         Print("DRAWDOWN HALT ",DoubleToString(ddPct,2),"%");
         TGRiskEvent("DRAWDOWN HALT", ddPct);
         LogCSV("RISK","drawdown halt",eq-bal,0);
         return false;
      }
   }
   return !rollbackMode;
}

//================ REPORTS =================
// (DailyReport lives in the Telegram engine — professional dashboard version)
void CheckReports()
{
   datetime todayStart = currentDay;
   datetime reportSlot = todayStart + DailyReportHour*3600 + DailyReportMinute*60;

   if(TimeCurrent() >= reportSlot && lastDailyReport < todayStart)
   {
      DailyReport();
      lastDailyReport = todayStart;
   }
}

//================ SELF-LEARNING =================
void LearningInit()
{
   for(int i=0;i<3;i++)
   {
      learnStat[i].trades  = 0;
      learnStat[i].wins    = 0;
      learnStat[i].profit  = 0;
      learnStat[i].riskMult= 1.0;
      learnStat[i].gridMult= 1.0;
      learnStat[i].lastAdaptScore = 0;
   }

   // Default strategy mapping: trend->TREND, range->RANGE, spike->BREAKOUT
   regimeStrategy[0].preferredStrategy = STRAT_TREND;
   regimeStrategy[1].preferredStrategy = STRAT_RANGE;
   regimeStrategy[2].preferredStrategy = STRAT_BREAKOUT;
   for(int i=0;i<3;i++)
   {
      regimeStrategy[i].confidence = StratConfidenceMin;
      regimeStrategy[i].tpUSD = 0;
      regimeStrategy[i].slUSD = 0;
      regimeStrategy[i].emaFast = 0;
      regimeStrategy[i].emaSlow = 0;
   }

   // Zero out per-strategy performance counters
   for(int r=0;r<3;r++)
      for(int s=0;s<3;s++)
      {
         stratStat[r][s].trades = 0;
         stratStat[r][s].wins   = 0;
         stratStat[r][s].profit = 0;
      }
}

void LoadLearning()
{
   int h = FileOpen(LearningFile, FILE_READ|FILE_BIN);
   if(h==INVALID_HANDLE) return;

   int ver = 0;
   FileReadStruct(h, ver);
   if(ver != 3)
   {
      FileClose(h);
      Print("Learning file version mismatch (expected 3), starting fresh.");
      return;
   }

   for(int i=0;i<3;i++)
   {
      FileReadStruct(h, learnStat[i].trades);
      FileReadStruct(h, learnStat[i].wins);
      FileReadStruct(h, learnStat[i].profit);
      FileReadStruct(h, learnStat[i].riskMult);
      FileReadStruct(h, learnStat[i].gridMult);
      FileReadStruct(h, learnStat[i].lastAdaptScore);

      int ps=0;
      FileReadStruct(h, ps);
      regimeStrategy[i].preferredStrategy = (StrategyType)ps;
      FileReadStruct(h, regimeStrategy[i].confidence);
      FileReadStruct(h, regimeStrategy[i].tpUSD);
      FileReadStruct(h, regimeStrategy[i].slUSD);
   }

   for(int r=0;r<3;r++)
      for(int s=0;s<3;s++)
      {
         FileReadStruct(h, stratStat[r][s].trades);
         FileReadStruct(h, stratStat[r][s].wins);
         FileReadStruct(h, stratStat[r][s].profit);
      }

   FileClose(h);

   Print("Learning loaded: ",
         "TREND t=",learnStat[0].trades," w=",learnStat[0].wins,
         " rM=",DoubleToString(learnStat[0].riskMult,2),
         " | RANGE t=",learnStat[1].trades," w=",learnStat[1].wins,
         " rM=",DoubleToString(learnStat[1].riskMult,2),
         " | SPIKE t=",learnStat[2].trades," w=",learnStat[2].wins,
         " rM=",DoubleToString(learnStat[2].riskMult,2));
}

void SaveLearning()
{
   int h = FileOpen(LearningFile, FILE_WRITE|FILE_BIN);
   if(h==INVALID_HANDLE)
   {
      Print("Learning save failed, error ",GetLastError());
      return;
   }

   int ver = 3;
   FileWriteStruct(h, ver);
   for(int i=0;i<3;i++)
   {
      FileWriteStruct(h, learnStat[i].trades);
      FileWriteStruct(h, learnStat[i].wins);
      FileWriteStruct(h, learnStat[i].profit);
      FileWriteStruct(h, learnStat[i].riskMult);
      FileWriteStruct(h, learnStat[i].gridMult);
      FileWriteStruct(h, learnStat[i].lastAdaptScore);

      int ps = (int)regimeStrategy[i].preferredStrategy;
      FileWriteStruct(h, ps);
      FileWriteStruct(h, regimeStrategy[i].confidence);
      FileWriteStruct(h, regimeStrategy[i].tpUSD);
      FileWriteStruct(h, regimeStrategy[i].slUSD);
   }

   for(int r=0;r<3;r++)
      for(int s=0;s<3;s++)
      {
         FileWriteStruct(h, stratStat[r][s].trades);
         FileWriteStruct(h, stratStat[r][s].wins);
         FileWriteStruct(h, stratStat[r][s].profit);
      }

   FileClose(h);
   lastLearnSave = TimeCurrent();
}

void RecordTrade(const double profit, const RegimeType regime, const int strategyIdx=-1)
{
   int idx = (int)regime;
   learnStat[idx].trades++;
   learnStat[idx].profit += profit;
   if(profit > 0) learnStat[idx].wins++;
   learnStat[idx].lastAdaptScore = profit;

   // Also record per-strategy performance if strategy known
   if(strategyIdx >= 0 && strategyIdx < 3)
   {
      stratStat[idx][strategyIdx].trades++;
      stratStat[idx][strategyIdx].profit += profit;
      if(profit > 0) stratStat[idx][strategyIdx].wins++;
   }
   LogCSV("LEARN","record "+RegimeName(regime),profit,0);
}

void AdaptLearning()
{
   for(int i=0;i<3;i++)
   {
      if(learnStat[i].trades < MinTradesToAdapt) continue;

      double winRate = (double)learnStat[i].wins / learnStat[i].trades;
      double profit  = learnStat[i].profit;

      if(winRate >= WinRateTarget && profit > 0)
      {
         learnStat[i].riskMult = MathMin(LearnRiskMultMax,
                                         learnStat[i].riskMult + AdaptStepRisk);
         learnStat[i].gridMult = MathMax(LearnGridMultMin,
                                         learnStat[i].gridMult - AdaptStepGrid);
         // Increase confidence in this regime's behaviour
         regimeStrategy[i].confidence = MathMin(StratConfidenceMax,
                                                regimeStrategy[i].confidence + StratConfidenceStep);
      }
      else if(winRate < (WinRateTarget - 0.10) || profit < 0)
      {
         learnStat[i].riskMult = MathMax(LearnRiskMultMin,
                                         learnStat[i].riskMult - AdaptStepRisk);
         learnStat[i].gridMult = MathMin(LearnGridMultMax,
                                         learnStat[i].gridMult + AdaptStepGrid);
         regimeStrategy[i].confidence = MathMax(StratConfidenceMin,
                                                regimeStrategy[i].confidence - StratConfidenceStep);
      }
   }

   // ADAPTIVE STRATEGY SELECTION: switch to the best-performing strategy per regime
   if(UseAdaptiveStrategy)
   {
      for(int r=0;r<3;r++)
      {
         int    bestStrat = -1;
         double bestScore = -1e9;
         double curScore  = -1e9;
         int    curStrat  = (int)regimeStrategy[r].preferredStrategy;

         for(int s=0;s<3;s++)
         {
            if(stratStat[r][s].trades < StratSwitchMinTrades) continue;
            double wr = (double)stratStat[r][s].wins / stratStat[r][s].trades;
            // Score = win rate weighted by profitability (normalized)
            double score = wr + (stratStat[r][s].profit > 0 ? 0.2 : -0.2);
            if(score > bestScore) { bestScore = score; bestStrat = s; }
            if(s == curStrat) curScore = score;
         }

         if(bestStrat >= 0 && bestStrat != curStrat &&
            (bestScore - curScore) >= StratSwitchMargin)
         {
            StrategyType oldS = regimeStrategy[r].preferredStrategy;
            regimeStrategy[r].preferredStrategy = (StrategyType)bestStrat;
            regimeStrategy[r].confidence = StratConfidenceMin; // reset, re-earn trust
            Print("STRATEGY SWITCH @ ",RegimeName((RegimeType)r),
                  " ",StratName(oldS)," -> ",StratName((StrategyType)bestStrat));
            Notify(TGHeader("STRATEGY SWITCH "+EMO("🔄")) +
                   EMO("🧭")+" Regime: <b>"+RegimeName((RegimeType)r)+"</b>\n" +
                   EMO("🔄")+" "+StratName(oldS)+" → <b>"+StratName((StrategyType)bestStrat)+"</b>\n" +
                   EMO("📊")+" Score: "+DoubleToString(curScore,2)+" → "+DoubleToString(bestScore,2));
         }
      }
   }
}

void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   if(!UseSelfLearning) return;
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;

   ulong dealTicket = trans.deal;
   if(!HistoryDealSelect(dealTicket)) return;

   long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   if((ulong)magic != MagicNumber) return;

   long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) return;

   double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                 + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                 + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);

   // Use the strategy that was active when the trade was opened
   RecordTrade(profit, currentRegime, lastDealStrategy);
   AdaptLearning();
   SaveLearning();
}

//================ MAIN =================
void OnTick()
{
   MarkNewDay();
   UpdateRegime();

   // Push live state to the web dashboard (throttled to DashboardPushSec)
   if(UseDashboard && DashboardMode != 0)
   {
      int pushSec = (DashboardPushSec < 2) ? 2 : DashboardPushSec;
      if(TimeCurrent() - lastDashboardPush >= pushSec)
      {
         lastDashboardPush = TimeCurrent();
         DashboardPush();
      }
   }

   if(!Risk()) return;

   // 1) Realize small profits fast on individual positions
   ManageMicroTP();

   // 2) Basket-level targets & safety
   ManageBasket();

   // 3) Add to existing trades on pullbacks (grid)
   ManageGrid();

   // 4) ADAPTIVE STRATEGY ENGINE — picks best strategy for current regime
   if(UseScalping)
   {
      StrategyType strat = PreferredStrategy(currentRegime);
      lastDealStrategy = (int)strat;
      lastDealRegime   = (int)currentRegime;
      string tag = StratName(strat);

      int sig = 0;
      // Run the chosen strategy's signal generator
      if(strat == STRAT_TREND)         sig = SignalTrend();
      else if(strat == STRAT_RANGE)    sig = SignalRange();
      else                             sig = SignalBreakout();

      // Primary entry from the adaptive strategy
      if(sig ==  1) OpenScalp(true,  "adapt-"+tag);
      if(sig == -1) OpenScalp(false, "adapt-"+tag);

      // Backup scalp engine: still allow micro-MA/RSI scalps (more trades)
      if(UseScalping)
      {
         int msig = ScalpSignal();
         if(msig ==  1) OpenScalp(true,  "micro-scalp");
         if(msig == -1) OpenScalp(false, "micro-scalp");
      }
   }

   // 5) Regime-specific opportunistic entries (extra trades)
   if(currentRegime == RANGE)
   {
      // Fade extremes aggressively in range
      double rsi = MicroRSI();
      if(rsi!=EMPTY_VALUE && rsi < RSI_Oversold)   OpenScalp(true,  "range-fade");
      if(rsi!=EMPTY_VALUE && rsi > RSI_Overbought) OpenScalp(false, "range-fade");
   }
   else if(currentRegime == TREND)
   {
      // Add on pullbacks within a trend (EMA retest)
      double rsi = MicroRSI();
      double maf = MicroMAF(), mas = MicroMAS();
      if(maf!=EMPTY_VALUE && mas!=EMPTY_VALUE && rsi!=EMPTY_VALUE)
      {
         if(maf>mas && rsi>40 && rsi<55) OpenScalp(true,  "trend-pullback");
         if(maf<mas && rsi<60 && rsi>45) OpenScalp(false, "trend-pullback");
      }
   }

   CheckReports();

   // Flush any pending Telegram batch so trade summaries are sent promptly
   TGFlushBatch(false);

   if(UseSelfLearning && TimeCurrent()-lastLearnSave >= LearningSaveSeconds)
      SaveLearning();
}
//+------------------------------------------------------------------+
