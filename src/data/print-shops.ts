/**
 * Curated Professional Commercial Print Shops Database
 * Taiwan & Major Hubs with Verified Commercial Print Capabilities
 */

export interface PrintShop {
  id: string;
  name: string;
  brand: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  website: string;
  businessHours: string;
  services: string[];
  features: string[];
  onlineUploadUrl: string;
}

export const CURATED_PRINT_SHOPS: PrintShop[] = [
  // 台北市
  {
    id: 'tp-gainhow-1',
    name: '健豪印刷 (台北忠孝門市)',
    brand: '健豪印刷',
    city: '台北市',
    district: '中正區',
    address: '台北市中正區忠孝西路一段66號',
    lat: 25.0465,
    lng: 121.5152,
    phone: '02-2388-7788',
    website: 'https://www.gainhow.tw/',
    businessHours: '週一至週五 09:00-21:00',
    services: ['合版印刷', '獨立版印刷', 'A4/A3海報', '名片/卡片', '數位打樣', 'UV局部上光'],
    features: ['線上即時估價', '支援直接傳檔', '全台連鎖物流'],
    onlineUploadUrl: 'https://www.gainhow.tw/'
  },
  {
    id: 'tp-classic-1',
    name: '經典數位印刷 (站前旗艦店)',
    brand: '經典數位印刷',
    city: '台北市',
    district: '中正區',
    address: '台北市中正區重慶南路一段75號',
    lat: 25.0441,
    lng: 121.5135,
    phone: '02-2382-6000',
    website: 'https://www.classicprint.com.tw/',
    businessHours: '週一至週六 09:00-22:00',
    services: ['急件快速直出', '大圖海報輸出', '藝術微噴', '膠裝/精裝', '350P象牙棉卡'],
    features: ['最快1小時急件出圖', '現場色彩打樣確認', '支援LINE傳檔'],
    onlineUploadUrl: 'https://www.classicprint.com.tw/'
  },
  {
    id: 'tp-cardhome-1',
    name: '卡之屋網路印刷 (台北總公司)',
    brand: '卡之屋',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區民生東路二段143號',
    lat: 25.0583,
    lng: 121.5332,
    phone: '02-2508-3333',
    website: 'https://www.cardhome.com.tw/',
    businessHours: '週一至週五 08:30-18:30',
    services: ['專業名片印刷', '明信片/酷卡', '貼紙模切', 'DM傳單', '特殊紙材'],
    features: ['豐富特殊紙庫', '線上自動檢檔系統', '業界信譽老牌'],
    onlineUploadUrl: 'https://www.cardhome.com.tw/'
  },
  {
    id: 'tp-qianye-1',
    name: '千業快速印刷 (同人誌/藝術專門)',
    brand: '千業印刷',
    city: '台北市',
    district: '中正區',
    address: '台北市中正區開封街一段2號3樓',
    lat: 25.0461,
    lng: 121.5159,
    phone: '02-2381-1234',
    website: 'http://www.qianye.com.tw/',
    businessHours: '週一至週五 09:00-19:00',
    services: ['藝術畫冊', '同人誌印刷', '特殊燙金', '日本萊妮/棉紙', '明信片套組'],
    features: ['動漫藝術圈指定名店', '色彩飽和度極佳', '少量多樣友善'],
    onlineUploadUrl: 'http://www.qianye.com.tw/'
  },
  {
    id: 'tp-jetprint-1',
    name: '捷可印 (台北松江門市)',
    brand: '捷可印',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區松江路101號',
    lat: 25.0512,
    lng: 121.5331,
    phone: '02-2507-6888',
    website: 'https://www.jetprint.com.tw/',
    businessHours: '週一至週五 09:00-20:00',
    services: ['商業型錄', '無摺痕海報', '展場易拉寶', '精裝硬殼本', '紙袋包裝'],
    features: ['線上3D即時打樣', '自動落版檢測', '專人色彩客服'],
    onlineUploadUrl: 'https://www.jetprint.com.tw/'
  },

  // 新北市
  {
    id: 'ntp-gainhow-1',
    name: '健豪印刷 (新北板橋門市)',
    brand: '健豪印刷',
    city: '新北市',
    district: '板橋區',
    address: '新北市板橋區文化路一段188號',
    lat: 25.0182,
    lng: 121.4682,
    phone: '02-2250-8899',
    website: 'https://www.gainhow.tw/',
    businessHours: '週一至週五 09:00-21:00',
    services: ['合版印刷', 'A4/A3海報', '展覽大圖', '各式貼紙', '商業手冊'],
    features: ['全台連鎖取件', '自動化線上傳檔', '高性價比'],
    onlineUploadUrl: 'https://www.gainhow.tw/'
  },
  {
    id: 'ntp-lange-1',
    name: '藍格印刷 (中和門市)',
    brand: '藍格印刷',
    city: '新北市',
    district: '中和區',
    address: '新北市中和區中山路二段350號',
    lat: 25.0035,
    lng: 121.4988,
    phone: '02-2240-5588',
    website: 'https://www.lange.com.tw/',
    businessHours: '週一至週五 08:30-18:00',
    services: ['合版名片', 'DM海報', '貼紙標籤', '桌曆/掛曆', '紙箱包裝'],
    features: ['大量印製超低單價', '線上自助看稿', '大台北免費配送點'],
    onlineUploadUrl: 'https://www.lange.com.tw/'
  },

  // 台中市
  {
    id: 'tc-gainhow-hq',
    name: '健豪印刷 (台中全球營運總部)',
    brand: '健豪印刷',
    city: '台中市',
    district: '南屯區',
    address: '台中市南屯區工業區二十四路26號',
    lat: 24.1592,
    lng: 120.6031,
    phone: '04-2359-5959',
    website: 'https://www.gainhow.tw/',
    businessHours: '24小時自動化生產 / 門市 08:00-22:00',
    services: ['全系列印刷', '工業級Indigo數位印刷', '八色高速輪轉機', '包裝彩盒', '精品裝訂'],
    features: ['全台最大數位印刷基地', '智慧化全自動流程', '最齊全紙材庫'],
    onlineUploadUrl: 'https://www.gainhow.tw/'
  },
  {
    id: 'tc-classic-1',
    name: '經典數位印刷 (台中中港店)',
    brand: '經典數位印刷',
    city: '台中市',
    district: '西區',
    address: '台中市西區台灣大道二段300號',
    lat: 24.1528,
    lng: 120.6658,
    phone: '04-2326-8000',
    website: 'https://www.classicprint.com.tw/',
    businessHours: '週一至週六 09:00-21:30',
    services: ['急件快速輸出', '展覽大圖', '明信片', '精裝書冊', '建築圖面'],
    features: ['現場快速取件', '高解析色彩校正', '支援急單'],
    onlineUploadUrl: 'https://www.classicprint.com.tw/'
  },

  // 高雄市
  {
    id: 'kh-gainhow-1',
    name: '健豪印刷 (高雄七賢門市)',
    brand: '健豪印刷',
    city: '高雄市',
    district: '新興區',
    address: '高雄市新興區七賢一路120號',
    lat: 22.6322,
    lng: 120.3095,
    phone: '07-236-8899',
    website: 'https://www.gainhow.tw/',
    businessHours: '週一至週五 09:00-21:00',
    services: ['合版印刷', '商業型錄', '海報/名片', '手提紙袋', '大圖輸出'],
    features: ['南台灣快速配送', '線上自助傳檔', '高性價比'],
    onlineUploadUrl: 'https://www.gainhow.tw/'
  },
  {
    id: 'kh-hongguo-1',
    name: '宏國數位印刷 (高雄總店)',
    brand: '宏國印刷',
    city: '高雄市',
    district: '三民區',
    address: '高雄市三民區建國二路180號',
    lat: 22.6385,
    lng: 120.3045,
    phone: '07-235-6677',
    website: 'https://www.hongguo.com.tw/',
    businessHours: '週一至週五 09:00-20:00',
    services: ['數位急件印刷', '海報打樣', '畫冊裝訂', '貼紙/名片', '展示板'],
    features: ['高雄老字號名店', '色彩管理嚴謹', '支援少量客製'],
    onlineUploadUrl: 'https://www.hongguo.com.tw/'
  },

  // 台南市
  {
    id: 'tn-times-1',
    name: '時代數位印刷 (台南成功店)',
    brand: '時代印刷',
    city: '台南市',
    district: '北區',
    address: '台南市北區成功路200號',
    lat: 22.9998,
    lng: 120.2052,
    phone: '06-228-5566',
    website: 'https://www.timesprint.com.tw/',
    businessHours: '週一至週五 09:00-20:00',
    services: ['商業海報', '名片酷卡', '精裝手冊', '特殊標籤', '展場立牌'],
    features: ['台南市區快速直出', '現場色彩確認', '專業美工諮詢'],
    onlineUploadUrl: 'https://www.timesprint.com.tw/'
  },

  // 新竹市
  {
    id: 'hc-jetprint-1',
    name: '捷可印 (新竹光復店)',
    brand: '捷可印',
    city: '新竹市',
    district: '東區',
    address: '新竹市東區光復路二段100號',
    lat: 24.7965,
    lng: 120.9982,
    phone: '03-571-8899',
    website: 'https://www.jetprint.com.tw/',
    businessHours: '週一至週五 09:00-19:30',
    services: ['科技業商業型錄', '研討會海報', '無摺痕展布', '工程手冊', '名片'],
    features: ['竹科園區快速送件', '線上3D預覽', 'ISO品質認證'],
    onlineUploadUrl: 'https://www.jetprint.com.tw/'
  }
];
