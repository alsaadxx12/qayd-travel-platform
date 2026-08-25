import React, { useState } from 'react';
import { Globe } from 'lucide-react';

export interface WorldCountry {
  code: string;
  nameAr: string;
  nameEn: string;
  keywords: string[];
}

export const ALL_WORLD_COUNTRIES: WorldCountry[] = [
  // ─── Arab & Middle East ───
  { code: 'iq', nameAr: 'العراق', nameEn: 'Iraq', keywords: ['عراق', 'العراق', 'بغداد', 'اربيل', 'البصرة', 'iraq', 'baghdad', 'erbil'] },
  { code: 'sa', nameAr: 'السعودية', nameEn: 'Saudi Arabia', keywords: ['سعودية', 'السعودية', 'رياض', 'جدة', 'مكة', 'عمرة', 'saudi', 'ksa', 'riyadh', 'jeddah'] },
  { code: 'ae', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', keywords: ['امارات', 'إمارات', 'الإمارات', 'دبي', 'ابوظبي', 'أبوظبي', 'الشارقة', 'uae', 'dubai', 'abu dhabi'] },
  { code: 'kw', nameAr: 'الكويت', nameEn: 'Kuwait', keywords: ['كويت', 'الكويت', 'kuwait'] },
  { code: 'qa', nameAr: 'قطر', nameEn: 'Qatar', keywords: ['قطر', 'الدوحة', 'دوحة', 'qatar', 'doha'] },
  { code: 'bh', nameAr: 'البحرين', nameEn: 'Bahrain', keywords: ['بحرين', 'البحرين', 'المنامة', 'bahrain', 'manama'] },
  { code: 'om', nameAr: 'سلطنة عمان', nameEn: 'Oman', keywords: ['عمان', 'عُمان', 'مسقط', 'oman', 'muscat'] },
  { code: 'jo', nameAr: 'الأردن', nameEn: 'Jordan', keywords: ['اردن', 'الأردن', 'عمان', 'jordan', 'amman'] },
  { code: 'lb', nameAr: 'لبنان', nameEn: 'Lebanon', keywords: ['لبنان', 'بيروت', 'lebanon', 'beirut'] },
  { code: 'sy', nameAr: 'سوريا', nameEn: 'Syria', keywords: ['سوريا', 'سورية', 'دمشق', 'حلب', 'syria', 'damascus'] },
  { code: 'ps', nameAr: 'فلسطين', nameEn: 'Palestine', keywords: ['فلسطين', 'القدس', 'غزة', 'palestine', 'jerusalem', 'gaza'] },
  { code: 'eg', nameAr: 'مصر', nameEn: 'Egypt', keywords: ['مصر', 'القاهرة', 'قاهرة', 'شرم', 'الاسكندرية', 'egypt', 'cairo', 'alexandria'] },
  { code: 'sd', nameAr: 'السودان', nameEn: 'Sudan', keywords: ['سودان', 'السودان', 'الخرطوم', 'sudan', 'khartoum'] },
  { code: 'ly', nameAr: 'ليبيا', nameEn: 'Libya', keywords: ['ليبيا', 'طرابلس', 'بنغازي', 'libya', 'tripoli'] },
  { code: 'tn', nameAr: 'تونس', nameEn: 'Tunisia', keywords: ['تونس', 'قرطاج', 'tunisia', 'tunis'] },
  { code: 'dz', nameAr: 'الجزائر', nameEn: 'Algeria', keywords: ['جزائر', 'الجزائر', 'وهران', 'algeria', 'algiers'] },
  { code: 'ma', nameAr: 'المغرب', nameEn: 'Morocco', keywords: ['مغرب', 'المغرب', 'الرباط', 'الدار البيضاء', 'كازا', 'مراكش', 'morocco', 'casablanca', 'rabat'] },
  { code: 'ye', nameAr: 'اليمن', nameEn: 'Yemen', keywords: ['يمن', 'اليمن', 'صنعاء', 'عدن', 'yemen', 'sanaa', 'aden'] },
  { code: 'so', nameAr: 'الصومال', nameEn: 'Somalia', keywords: ['صومال', 'الصومال', 'مقديشو', 'somalia', 'mogadishu'] },
  { code: 'dj', nameAr: 'جيبوتي', nameEn: 'Djibouti', keywords: ['جيبوتي', 'djibouti'] },
  { code: 'mr', nameAr: 'موريتانيا', nameEn: 'Mauritania', keywords: ['موريتانيا', 'نواكشوط', 'mauritania'] },
  { code: 'km', nameAr: 'جزر القمر', nameEn: 'Comoros', keywords: ['جزر القمر', 'موروني', 'comoros'] },

  // ─── Asia & Eurasia ───
  { code: 'tr', nameAr: 'تركيا', nameEn: 'Turkey', keywords: ['تركيا', 'اسطنبول', 'إسطنبول', 'أنقرة', 'انطاليا', 'turkey', 'turkiye', 'istanbul', 'ankara', 'antalya'] },
  { code: 'ir', nameAr: 'إيران', nameEn: 'Iran', keywords: ['ايران', 'إيران', 'طهران', 'مشهد', 'اصفهان', 'iran', 'tehran', 'mashhad'] },
  { code: 'th', nameAr: 'تايلند', nameEn: 'Thailand', keywords: ['تايلند', 'تايلاند', 'بانكوك', 'بوكيت', 'بتايا', 'thailand', 'thai', 'bangkok', 'phuket'] },
  { code: 'id', nameAr: 'إندونيسيا', nameEn: 'Indonesia', keywords: ['اندونيسيا', 'إندونيسيا', 'جاكرتا', 'بالي', 'بونشاك', 'indonesia', 'jakarta', 'bali'] },
  { code: 'my', nameAr: 'ماليزيا', nameEn: 'Malaysia', keywords: ['ماليزيا', 'كوالالمبور', 'بيناج', 'لنكاوي', 'malaysia', 'kuala lumpur', 'penang'] },
  { code: 'cn', nameAr: 'الصين', nameEn: 'China', keywords: ['صين', 'الصين', 'بكين', 'كوانزو', 'شنغهاي', 'ايوو', 'china', 'beijing', 'guangzhou', 'shanghai'] },
  { code: 'in', nameAr: 'الهند', nameEn: 'India', keywords: ['هند', 'الهند', 'دلهي', 'مومباي', 'كيرلا', 'بانغالور', 'india', 'delhi', 'mumbai', 'kerala'] },
  { code: 'pk', nameAr: 'باكستان', nameEn: 'Pakistan', keywords: ['باكستان', 'إسلام آباد', 'لاهور', 'كراتشي', 'pakistan', 'islamabad', 'lahore', 'karachi'] },
  { code: 'bd', nameAr: 'بنغلاديش', nameEn: 'Bangladesh', keywords: ['بنغلاديش', 'بنقلاديش', 'دكا', 'bangladesh', 'dhaka'] },
  { code: 'ph', nameAr: 'الفلبين', nameEn: 'Philippines', keywords: ['فلبين', 'الفلبين', 'مانيلا', 'سيبو', 'philippines', 'manila'] },
  { code: 'vn', nameAr: 'فيتنام', nameEn: 'Vietnam', keywords: ['فيتنام', 'هانوي', 'هو تشي منه', 'دا نانغ', 'vietnam', 'hanoi'] },
  { code: 'jp', nameAr: 'اليابان', nameEn: 'Japan', keywords: ['يابان', 'اليابان', 'طوكيو', 'أوساكا', 'japan', 'tokyo', 'osaka'] },
  { code: 'kr', nameAr: 'كوريا الجنوبية', nameEn: 'South Korea', keywords: ['كوريا الجنوبية', 'كوريا', 'سول', 'سيول', 'korea', 'south korea', 'seoul'] },
  { code: 'kp', nameAr: 'كوريا الشمالية', nameEn: 'North Korea', keywords: ['كوريا الشمالية', 'بيونغ يانغ', 'north korea'] },
  { code: 'sg', nameAr: 'سنغافورة', nameEn: 'Singapore', keywords: ['سنغافورة', 'singapore'] },
  { code: 'ru', nameAr: 'روسيا', nameEn: 'Russia', keywords: ['روسيا', 'موسكو', 'سانت بطرسبرغ', 'russia', 'moscow', 'saint petersburg'] },
  { code: 'az', nameAr: 'أذربيجان', nameEn: 'Azerbaijan', keywords: ['اذربيجان', 'أذربيجان', 'باكو', 'غابالا', 'azerbaijan', 'baku'] },
  { code: 'ge', nameAr: 'جورجيا', nameEn: 'Georgia', keywords: ['جورجيا', 'تبليسي', 'باتومي', 'georgia', 'tbilisi', 'batumi'] },
  { code: 'am', nameAr: 'أرمينيا', nameEn: 'Armenia', keywords: ['ارمينيا', 'أرمينيا', 'يريفان', 'armenia', 'yerevan'] },
  { code: 'kz', nameAr: 'كازاخستان', nameEn: 'Kazakhstan', keywords: ['كازاخستان', 'أستانا', 'ألماتي', 'kazakhstan', 'astana', 'almaty'] },
  { code: 'uz', nameAr: 'أوزبكستان', nameEn: 'Uzbekistan', keywords: ['اوزبكستان', 'أوزبكستان', 'طشقند', 'سمرقند', 'بخارى', 'uzbekistan', 'tashkent', 'samarkand'] },
  { code: 'kg', nameAr: 'قيرغيزستان', nameEn: 'Kyrgyzstan', keywords: ['قيرغيزستان', 'قرغيزستان', 'بيشكيك', 'kyrgyzstan', 'bishkek'] },
  { code: 'tj', nameAr: 'طاجيكستان', nameEn: 'Tajikistan', keywords: ['طاجيكستان', 'دوشنبه', 'tajikistan', 'dushanbe'] },
  { code: 'tm', nameAr: 'تركمانستان', nameEn: 'Turkmenistan', keywords: ['تركمانستان', 'عشق آباد', 'turkmenistan'] },
  { code: 'af', nameAr: 'أفغانستان', nameEn: 'Afghanistan', keywords: ['افغانستان', 'أفغانستان', 'كابل', 'afghanistan', 'kabul'] },
  { code: 'lk', nameAr: 'سريلانكا', nameEn: 'Sri Lanka', keywords: ['سريلانكا', 'كولومبو', 'sri lanka', 'colombo'] },
  { code: 'np', nameAr: 'نيبال', nameEn: 'Nepal', keywords: ['نيبال', 'كاتماندو', 'nepal', 'kathmandu'] },
  { code: 'mv', nameAr: 'المالديف', nameEn: 'Maldives', keywords: ['مالديف', 'المالديف', 'ماليه', 'maldives', 'male'] },
  { code: 'mm', nameAr: 'ميانمار', nameEn: 'Myanmar', keywords: ['ميانمار', 'بورما', 'يانغون', 'myanmar', 'burma'] },
  { code: 'kh', nameAr: 'كمبوديا', nameEn: 'Cambodia', keywords: ['كمبوديا', 'بنوم بنه', 'cambodia', 'phnom penh'] },
  { code: 'la', nameAr: 'لاوس', nameEn: 'Laos', keywords: ['لاوس', 'فيينتيان', 'laos'] },
  { code: 'mn', nameAr: 'منغوليا', nameEn: 'Mongolia', keywords: ['منغوليا', 'أولان باتور', 'mongolia'] },
  { code: 'bn', nameAr: 'بروناي', nameEn: 'Brunei', keywords: ['بروناي', 'بندر سري بكاوان', 'brunei'] },
  { code: 'bt', nameAr: 'بوتان', nameEn: 'Bhutan', keywords: ['بوتان', 'تيمفو', 'bhutan'] },
  { code: 'tw', nameAr: 'تايوان', nameEn: 'Taiwan', keywords: ['تايوان', 'تايبيه', 'taiwan', 'taipei'] },
  { code: 'hk', nameAr: 'هونغ كونغ', nameEn: 'Hong Kong', keywords: ['هونغ كونغ', 'هونج كونج', 'hong kong'] },
  { code: 'mo', nameAr: 'ماكاو', nameEn: 'Macau', keywords: ['ماكاو', 'macau'] },
  { code: 'tl', nameAr: 'تيمور الشرقية', nameEn: 'East Timor', keywords: ['تيمور الشرقية', 'ديلي', 'timor'] },

  // ─── Europe ───
  { code: 'eu', nameAr: 'الاتحاد الأوروبي (شنغن)', nameEn: 'European Union (Schengen)', keywords: ['شنغن', 'شنجن', 'اوروبا', 'أوروبا', 'الاتحاد الاوروبي', 'schengen', 'europe', 'eu'] },
  { code: 'gb', nameAr: 'المملكة المتحدة (بريطانيا)', nameEn: 'United Kingdom', keywords: ['بريطانيا', 'انجلترا', 'لندن', 'المملكة المتحدة', 'اسكتلندا', 'uk', 'britain', 'england', 'london'] },
  { code: 'fr', nameAr: 'فرنسا', nameEn: 'France', keywords: ['فرنسا', 'باريس', 'نيس', 'france', 'paris', 'nice'] },
  { code: 'de', nameAr: 'ألمانيا', nameEn: 'Germany', keywords: ['المانيا', 'ألمانيا', 'برلين', 'ميونخ', 'فرانكفورت', 'germany', 'berlin', 'munich', 'frankfurt'] },
  { code: 'it', nameAr: 'إيطاليا', nameEn: 'Italy', keywords: ['ايطاليا', 'إيطاليا', 'روما', 'ميلانو', 'فينيسيا', 'البندقية', 'italy', 'rome', 'milan', 'venice'] },
  { code: 'es', nameAr: 'إسبانيا', nameEn: 'Spain', keywords: ['اسبانيا', 'إسبانيا', 'مدريد', 'برشلونة', 'ملقة', 'spain', 'madrid', 'barcelona', 'malaga'] },
  { code: 'ch', nameAr: 'سويسرا', nameEn: 'Switzerland', keywords: ['سويسرا', 'جنيف', 'زيورخ', 'إنترلاكن', 'switzerland', 'geneva', 'zurich'] },
  { code: 'nl', nameAr: 'هولندا', nameEn: 'Netherlands', keywords: ['هولندا', 'امستردام', 'روتردام', 'netherlands', 'holland', 'amsterdam'] },
  { code: 'be', nameAr: 'بلجيكا', nameEn: 'Belgium', keywords: ['بلجيكا', 'بروكسل', 'belgium', 'brussels'] },
  { code: 'at', nameAr: 'النمسا', nameEn: 'Austria', keywords: ['نمسا', 'النمسا', 'فيينا', 'زيلامسي', 'سالزبورغ', 'austria', 'vienna', 'salzburg'] },
  { code: 'se', nameAr: 'السويد', nameEn: 'Sweden', keywords: ['سويد', 'السويد', 'ستوكهولم', 'sweden', 'stockholm'] },
  { code: 'no', nameAr: 'النرويج', nameEn: 'Norway', keywords: ['نرويج', 'النرويج', 'أوسلو', 'norway', 'oslo'] },
  { code: 'dk', nameAr: 'الدنمارك', nameEn: 'Denmark', keywords: ['دنمارك', 'الدنمارك', 'كوبنهاغن', 'denmark', 'copenhagen'] },
  { code: 'fi', nameAr: 'فنلندا', nameEn: 'Finland', keywords: ['فنلندا', 'هلسنكي', 'finland', 'helsinki'] },
  { code: 'ie', nameAr: 'أيرلندا', nameEn: 'Ireland', keywords: ['ايرلندا', 'أيرلندا', 'دبلن', 'ireland', 'dublin'] },
  { code: 'pt', nameAr: 'البرتغال', nameEn: 'Portugal', keywords: ['برتغال', 'البرتغال', 'لشبونة', 'بورتو', 'portugal', 'lisbon', 'porto'] },
  { code: 'gr', nameAr: 'اليونان', nameEn: 'Greece', keywords: ['يونان', 'اليونان', 'أثينا', 'سانتوريني', 'ميكونوس', 'greece', 'athens', 'santorini'] },
  { code: 'cy', nameAr: 'قبرص', nameEn: 'Cyprus', keywords: ['قبرص', 'لارنكا', 'ليماسول', 'نيقوسيا', 'cyprus', 'larnaca', 'nicosia'] },
  { code: 'pl', nameAr: 'بولندا', nameEn: 'Poland', keywords: ['بولندا', 'وارسو', 'كراكوف', 'poland', 'warsaw', 'krakow'] },
  { code: 'cz', nameAr: 'التشيك', nameEn: 'Czech Republic', keywords: ['تشيك', 'التشيك', 'براغ', 'czech', 'prague'] },
  { code: 'hu', nameAr: 'المجر (هنغاريا)', nameEn: 'Hungary', keywords: ['مجر', 'المجر', 'هنغاريا', 'بودابست', 'hungary', 'budapest'] },
  { code: 'ro', nameAr: 'رومانيا', nameEn: 'Romania', keywords: ['رومانيا', 'بوخارست', 'romania', 'bucharest'] },
  { code: 'bg', nameAr: 'بلغاريا', nameEn: 'Bulgaria', keywords: ['بلغاريا', 'صوفيا', 'bulgaria', 'sofia'] },
  { code: 'hr', nameAr: 'كرواتيا', nameEn: 'Croatia', keywords: ['كرواتيا', 'زغرب', 'دوبروفنيك', 'croatia', 'zagreb', 'dubrovnik'] },
  { code: 'ba', nameAr: 'البوسنة والهرسك', nameEn: 'Bosnia and Herzegovina', keywords: ['بوسنة', 'البوسنة', 'سراييفو', 'موستار', 'bosnia', 'sarajevo', 'mostar'] },
  { code: 'rs', nameAr: 'صربيا', nameEn: 'Serbia', keywords: ['صربيا', 'بلغراد', 'serbia', 'belgrade'] },
  { code: 'me', nameAr: 'الجبل الأسود (مونتينيغرو)', nameEn: 'Montenegro', keywords: ['مونتينيغرو', 'الجبل الاسود', 'بودغوريتسا', 'كوتور', 'montenegro', 'podgorica'] },
  { code: 'al', nameAr: 'ألبانيا', nameEn: 'Albania', keywords: ['البانيا', 'ألبانيا', 'تيرانا', 'albania', 'tirana'] },
  { code: 'mk', nameAr: 'مقدونيا الشمالية', nameEn: 'North Macedonia', keywords: ['مقدونيا', 'سكوبيه', 'macedonia', 'skopje'] },
  { code: 'sk', nameAr: 'سلوفاكيا', nameEn: 'Slovakia', keywords: ['سلوفاكيا', 'براتيسلافا', 'slovakia', 'bratislava'] },
  { code: 'si', nameAr: 'سلوفينيا', nameEn: 'Slovenia', keywords: ['سلوفينيا', 'ليوبليانا', 'slovenia', 'ljubljana'] },
  { code: 'by', nameAr: 'بيلاروسيا', nameEn: 'Belarus', keywords: ['بيلاروسيا', 'مينسك', 'belarus', 'minsk'] },
  { code: 'ua', nameAr: 'أوكرانيا', nameEn: 'Ukraine', keywords: ['اوكرانيا', 'أوكرانيا', 'كييف', 'ukraine', 'kyiv'] },
  { code: 'md', nameAr: 'مولدوفا', nameEn: 'Moldova', keywords: ['مولدوفا', 'كيشيناو', 'moldova', 'chisinau'] },
  { code: 'lt', nameAr: 'ليتوانيا', nameEn: 'Lithuania', keywords: ['ليتوانيا', 'فيلنيوس', 'lithuania', 'vilnius'] },
  { code: 'lv', nameAr: 'لاتفيا', nameEn: 'Latvia', keywords: ['لاتفيا', 'ريغا', 'latvia', 'riga'] },
  { code: 'ee', nameAr: 'إستونيا', nameEn: 'Estonia', keywords: ['استونيا', 'إستونيا', 'تالين', 'estonia', 'tallinn'] },
  { code: 'is', nameAr: 'آيسلندا', nameEn: 'Iceland', keywords: ['ايسلندا', 'آيسلندا', 'ريكيافيك', 'iceland', 'reykjavik'] },
  { code: 'mt', nameAr: 'مالطا', nameEn: 'Malta', keywords: ['مالطا', 'فاليتا', 'malta', 'valletta'] },
  { code: 'lu', nameAr: 'لوكسمبورغ', nameEn: 'Luxembourg', keywords: ['لوكسمبورغ', 'luxembourg'] },
  { code: 'mc', nameAr: 'موناكو', nameEn: 'Monaco', keywords: ['موناكو', 'monaco'] },
  { code: 'ad', nameAr: 'أندورا', nameEn: 'Andorra', keywords: ['اندورا', 'أندورا', 'andorra'] },
  { code: 'sm', nameAr: 'سان مارينو', nameEn: 'San Marino', keywords: ['سان مارينو', 'san marino'] },
  { code: 'va', nameAr: 'الفاتيكان', nameEn: 'Vatican City', keywords: ['فاتيكان', 'الفاتيكان', 'vatican'] },
  { code: 'li', nameAr: 'ليختنشتاين', nameEn: 'Liechtenstein', keywords: ['ليختنشتاين', 'liechtenstein'] },
  { code: 'xk', nameAr: 'كوسوفو', nameEn: 'Kosovo', keywords: ['كوسوفو', 'بريشتينا', 'kosovo', 'pristina'] },

  // ─── Americas ───
  { code: 'us', nameAr: 'الولايات المتحدة (أمريكا)', nameEn: 'United States', keywords: ['امريكا', 'أمريكا', 'الولايات المتحدة', 'واشنطن', 'نيويورك', 'كاليفورنيا', 'فلوريدا', 'usa', 'america', 'united states', 'new york'] },
  { code: 'ca', nameAr: 'كندا', nameEn: 'Canada', keywords: ['كندا', 'تورنتو', 'مونتريال', 'فانكوفر', 'أوتاوا', 'canada', 'toronto', 'montreal', 'vancouver'] },
  { code: 'mx', nameAr: 'المكسيك', nameEn: 'Mexico', keywords: ['مكسيك', 'المكسيك', 'مكسيكو سيتي', 'كانكون', 'mexico', 'cancun'] },
  { code: 'br', nameAr: 'البرازيل', nameEn: 'Brazil', keywords: ['برازيل', 'البرازيل', 'ساو باولو', 'ريو دي جانيرو', 'brazil', 'sao paulo', 'rio'] },
  { code: 'ar', nameAr: 'الأرجنتين', nameEn: 'Argentina', keywords: ['ارجنتين', 'الأرجنتين', 'بوينس آيرس', 'argentina', 'buenos aires'] },
  { code: 'cl', nameAr: 'تشيلي', nameEn: 'Chile', keywords: ['تشيلي', 'سانتياغو', 'chile', 'santiago'] },
  { code: 'co', nameAr: 'كولومبيا', nameEn: 'Colombia', keywords: ['كولومبيا', 'بوغوتا', 'ميديلين', 'colombia', 'bogota'] },
  { code: 'pe', nameAr: 'بيرو', nameEn: 'Peru', keywords: ['بيرو', 'ليما', 'ماتشو بيتشو', 'peru', 'lima'] },
  { code: 've', nameAr: 'فنزويلا', nameEn: 'Venezuela', keywords: ['فنزويلا', 'كاراكاس', 'venezuela', 'caracas'] },
  { code: 'ec', nameAr: 'الإكوادور', nameEn: 'Ecuador', keywords: ['اكوادور', 'الإكوادور', 'كيتو', 'ecuador', 'quito'] },
  { code: 'bo', nameAr: 'بوليفيا', nameEn: 'Bolivia', keywords: ['بوليفيا', 'لاباز', 'bolivia', 'la paz'] },
  { code: 'py', nameAr: 'باراغواي', nameEn: 'Paraguay', keywords: ['باراغواي', 'أسونسيون', 'paraguay', 'asuncion'] },
  { code: 'uy', nameAr: 'أوروغواي', nameEn: 'Uruguay', keywords: ['اوروغواي', 'أوروغواي', 'مونتيفيديو', 'uruguay', 'montevideo'] },
  { code: 'gy', nameAr: 'غيانا', nameEn: 'Guyana', keywords: ['غيانا', 'جورج تاون', 'guyana'] },
  { code: 'sr', nameAr: 'سورينام', nameEn: 'Suriname', keywords: ['سورينام', 'باراماريبو', 'suriname'] },
  { code: 'pa', nameAr: 'بنما', nameEn: 'Panama', keywords: ['بنما', 'قناة بنما', 'panama'] },
  { code: 'cr', nameAr: 'كوستاريكا', nameEn: 'Costa Rica', keywords: ['كوستاريكا', 'سان خوسيه', 'costa rica', 'san jose'] },
  { code: 'cu', nameAr: 'كوبا', nameEn: 'Cuba', keywords: ['كوبا', 'هافانا', 'cuba', 'havana'] },
  { code: 'do', nameAr: 'جمهورية الدومينيكان', nameEn: 'Dominican Republic', keywords: ['دومينيكان', 'الدومينيكان', 'سانتو دومينغو', 'بونتا كانا', 'dominican', 'punta cana'] },
  { code: 'pr', nameAr: 'بورتوريكو', nameEn: 'Puerto Rico', keywords: ['بورتوريكو', 'سان خوان', 'puerto rico'] },
  { code: 'jm', nameAr: 'جامايكا', nameEn: 'Jamaica', keywords: ['جامايكا', 'كينغستون', 'jamaica', 'kingston'] },
  { code: 'ht', nameAr: 'هايتي', nameEn: 'Haiti', keywords: ['هايتي', 'بورت أو برنس', 'haiti'] },
  { code: 'gt', nameAr: 'غواتيمالا', nameEn: 'Guatemala', keywords: ['غواتيمالا', 'guatemala'] },
  { code: 'hn', nameAr: 'هندوراس', nameEn: 'Honduras', keywords: ['هندوراس', 'تيغوسيغالبا', 'honduras'] },
  { code: 'sv', nameAr: 'السلفادور', nameEn: 'El Salvador', keywords: ['سلفادور', 'السلفادور', 'el salvador'] },
  { code: 'ni', nameAr: 'نيكاراغوا', nameEn: 'Nicaragua', keywords: ['نيكاراغوا', 'ماناغوا', 'nicaragua'] },
  { code: 'bs', nameAr: 'باهاماس', nameEn: 'Bahamas', keywords: ['باهاماس', 'البهاما', 'ناساو', 'bahamas', 'nassau'] },
  { code: 'tt', nameAr: 'ترينيداد وتوباغو', nameEn: 'Trinidad and Tobago', keywords: ['ترينيداد', 'trinidad'] },
  { code: 'bb', nameAr: 'باربادوس', nameEn: 'Barbados', keywords: ['باربادوس', 'بريدج تاون', 'barbados'] },
  { code: 'bz', nameAr: 'بليز', nameEn: 'Belize', keywords: ['بليز', 'belize'] },

  // ─── Africa ───
  { code: 'za', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa', keywords: ['جنوب افريقيا', 'جنوب أفريقيا', 'كيب تاون', 'جوهانسبرغ', 'south africa', 'cape town', 'johannesburg'] },
  { code: 'ng', nameAr: 'نيجيريا', nameEn: 'Nigeria', keywords: ['نيجيريا', 'أبوجا', 'لاغوس', 'nigeria', 'abuja', 'lagos'] },
  { code: 'ke', nameAr: 'كينيا', nameEn: 'Kenya', keywords: ['كينيا', 'نيروبي', 'مومباسا', 'kenya', 'nairobi'] },
  { code: 'et', nameAr: 'إثيوبيا', nameEn: 'Ethiopia', keywords: ['اثيوبيا', 'إثيوبيا', 'أديس أبابا', 'ethiopia', 'addis ababa'] },
  { code: 'gh', nameAr: 'غانا', nameEn: 'Ghana', keywords: ['غانا', 'أكرا', 'ghana', 'accra'] },
  { code: 'tz', nameAr: 'تنزانيا', nameEn: 'Tanzania', keywords: ['تنزانيا', 'زنجبار', 'دار السلام', 'tanzania', 'zanzibar'] },
  { code: 'ug', nameAr: 'أوغندا', nameEn: 'Uganda', keywords: ['اوغندا', 'أوغندا', 'كمبالا', 'uganda', 'kampala'] },
  { code: 'sn', nameAr: 'السنغال', nameEn: 'Senegal', keywords: ['سنغال', 'السنغال', 'داكار', 'senegal', 'dakar'] },
  { code: 'ci', nameAr: 'ساحل العاج (كوت ديفوار)', nameEn: 'Ivory Coast', keywords: ['ساحل العاج', 'كوت ديفوار', 'أبيدجان', 'ivory coast', 'cote d\'ivoire'] },
  { code: 'cm', nameAr: 'الكاميرون', nameEn: 'Cameroon', keywords: ['كاميرون', 'الكاميرون', 'ياوندي', 'دوالا', 'cameroon'] },
  { code: 'ao', nameAr: 'أنغولا', nameEn: 'Angola', keywords: ['انغولا', 'أنغولا', 'لواندا', 'angola', 'luanda'] },
  { code: 'mz', nameAr: 'موزمبيق', nameEn: 'Mozambique', keywords: ['موزمبيق', 'مابوتو', 'mozambique'] },
  { code: 'zm', nameAr: 'زامبيا', nameEn: 'Zambia', keywords: ['زامبيا', 'لوساكا', 'zambia'] },
  { code: 'zw', nameAr: 'زيمبابوي', nameEn: 'Zimbabwe', keywords: ['زيمبابوي', 'هراري', 'شلالات فيكتوريا', 'zimbabwe'] },
  { code: 'rw', nameAr: 'رواندا', nameEn: 'Rwanda', keywords: ['رواندا', 'كيغالي', 'rwanda', 'kigali'] },
  { code: 'mu', nameAr: 'موريشيوس', nameEn: 'Mauritius', keywords: ['موريشيوس', 'موريشيوس', 'بورت لويس', 'mauritius'] },
  { code: 'sc', nameAr: 'سيشل', nameEn: 'Seychelles', keywords: ['سيشل', 'جزر سيشل', 'فيكتوريا', 'seychelles'] },
  { code: 'mg', nameAr: 'مدغشقر', nameEn: 'Madagascar', keywords: ['مدغشقر', 'أنتاناناريفو', 'madagascar'] },
  { code: 'na', nameAr: 'ناميبيا', nameEn: 'Namibia', keywords: ['ناميبيا', 'ويندهوك', 'namibia'] },
  { code: 'bw', nameAr: 'بوتسوانا', nameEn: 'Botswana', keywords: ['بوتسوانا', 'غابورون', 'botswana'] },
  { code: 'ga', nameAr: 'الغابون', nameEn: 'Gabon', keywords: ['غابون', 'الغابون', 'ليبرفيل', 'gabon'] },
  { code: 'cg', nameAr: 'الكونغو', nameEn: 'Republic of the Congo', keywords: ['كونغو', 'الكونغو', 'برازافيل', 'congo', 'brazzaville'] },
  { code: 'cd', nameAr: 'الكونغو الديمقراطية', nameEn: 'DR Congo', keywords: ['الكونغو الديمقراطية', 'كينشاسا', 'dr congo', 'kinshasa'] },
  { code: 'ml', nameAr: 'مالي', nameEn: 'Mali', keywords: ['مالي', 'باماكو', 'mali', 'bamako'] },
  { code: 'ne', nameAr: 'النيجر', nameEn: 'Niger', keywords: ['نيجر', 'النيجر', 'نيامي', 'niger'] },
  { code: 'td', nameAr: 'تشاد', nameEn: 'Chad', keywords: ['تشاد', 'انجامينا', 'chad'] },
  { code: 'gn', nameAr: 'غينيا', nameEn: 'Guinea', keywords: ['غينيا', 'كوناكري', 'guinea'] },
  { code: 'bf', nameAr: 'بوركينا فاسو', nameEn: 'Burkina Faso', keywords: ['بوركينا فاسو', 'واغادوغو', 'burkina faso'] },
  { code: 'bj', nameAr: 'بنين', nameEn: 'Benin', keywords: ['بنين', 'بورتو نوفو', 'benin'] },
  { code: 'tg', nameAr: 'توغو', nameEn: 'Togo', keywords: ['توغو', 'لومي', 'togo'] },
  { code: 'sl', nameAr: 'سيراليون', nameEn: 'Sierra Leone', keywords: ['سيراليون', 'فريتاون', 'sierra leone'] },
  { code: 'lr', nameAr: 'ليبيريا', nameEn: 'Liberia', keywords: ['ليبيريا', 'مونروفيا', 'liberia'] },
  { code: 'gm', nameAr: 'غامبيا', nameEn: 'Gambia', keywords: ['غامبيا', 'بانجول', 'gambia'] },
  { code: 'gw', nameAr: 'غينيا بيساو', nameEn: 'Guinea-Bissau', keywords: ['غينيا بيساو', 'guinea-bissau'] },
  { code: 'cv', nameAr: 'الرأس الأخضر', nameEn: 'Cape Verde', keywords: ['الراس الاخضر', 'الرأس الأخضر', 'برايا', 'cape verde'] },
  { code: 'gq', nameAr: 'غينيا الاستوائية', nameEn: 'Equatorial Guinea', keywords: ['غينيا الاستوائية', 'مالابو', 'equatorial guinea'] },
  { code: 'st', nameAr: 'ساو تومي وبرينسيب', nameEn: 'Sao Tome and Principe', keywords: ['ساو تومي', 'sao tome'] },
  { code: 'er', nameAr: 'إريتريا', nameEn: 'Eritrea', keywords: ['اريتريا', 'إريتريا', 'أسمرة', 'eritrea', 'asmara'] },
  { code: 'ss', nameAr: 'جنوب السودان', nameEn: 'South Sudan', keywords: ['جنوب السودان', 'جوبا', 'south sudan', 'juba'] },
  { code: 'bi', nameAr: 'بوروندي', nameEn: 'Burundi', keywords: ['بوروندي', 'غيتيغا', 'burundi'] },
  { code: 'mw', nameAr: 'ملاوي', nameEn: 'Malawi', keywords: ['ملاوي', 'ليلونغوي', 'malawi'] },
  { code: 'sz', nameAr: 'إسواتيني', nameEn: 'Eswatini', keywords: ['سوازيلاند', 'إسواتيني', 'eswatini', 'swaziland'] },
  { code: 'ls', nameAr: 'ليسوتو', nameEn: 'Lesotho', keywords: ['ليسوتو', 'ماسيرو', 'lesotho'] },
  { code: 'cf', nameAr: 'جمهورية أفريقيا الوسطى', nameEn: 'Central African Republic', keywords: ['افريقيا الوسطى', 'بانغي', 'central african republic'] },

  // ─── Oceania ───
  { code: 'au', nameAr: 'أستراليا', nameEn: 'Australia', keywords: ['استراليا', 'أستراليا', 'سيدني', 'ملبورن', 'كانبيرا', 'australia', 'sydney', 'melbourne'] },
  { code: 'nz', nameAr: 'نيوزيلندا', nameEn: 'New Zealand', keywords: ['نيوزيلندا', 'نيوزيلاندا', 'أوكلاند', 'ويلينغتون', 'new zealand', 'auckland'] },
  { code: 'fj', nameAr: 'فيجي', nameEn: 'Fiji', keywords: ['فيجي', 'سوفا', 'fiji', 'suva'] },
  { code: 'pg', nameAr: 'بابوا غينيا الجديدة', nameEn: 'Papua New Guinea', keywords: ['بابوا', 'بورت مورسبي', 'papua new guinea'] },
  { code: 'ws', nameAr: 'ساموا', nameEn: 'Samoa', keywords: ['ساموا', 'أبيا', 'samoa'] },
  { code: 'to', nameAr: 'تونغا', nameEn: 'Tonga', keywords: ['تونغا', 'نوكو ألوفا', 'tonga'] },
  { code: 'vu', nameAr: 'فانواتو', nameEn: 'Vanuatu', keywords: ['فانواتو', 'بورت فيلا', 'vanuatu'] },
  { code: 'sb', nameAr: 'جزر سليمان', nameEn: 'Solomon Islands', keywords: ['جزر سليمان', 'هونيارا', 'solomon islands'] },
  { code: 'fm', nameAr: 'ميكرونيزيا', nameEn: 'Micronesia', keywords: ['ميكرونيزيا', 'micronesia'] },
  { code: 'pw', nameAr: 'بالاو', nameEn: 'Palau', keywords: ['بالاو', 'palau'] },
  { code: 'mh', nameAr: 'جزر مارشال', nameEn: 'Marshall Islands', keywords: ['مارشال', 'جزر مارشال', 'marshall islands'] },
  { code: 'ki', nameAr: 'كيريباتي', nameEn: 'Kiribati', keywords: ['كيريباتي', 'kiribati'] },
  { code: 'nr', nameAr: 'ناورو', nameEn: 'Nauru', keywords: ['ناورو', 'nauru'] },
  { code: 'tv', nameAr: 'توفالو', nameEn: 'Tuvalu', keywords: ['توفالو', 'tuvalu'] },
];

export function resolveCountryCode(textOrCode?: string): string | null {
  if (!textOrCode) return null;
  const clean = textOrCode.trim().toLowerCase();

  // If already 2-letter code
  if (clean.length === 2 && /^[a-z]{2}$/.test(clean)) {
    return clean;
  }

  // Search through all world countries
  for (const c of ALL_WORLD_COUNTRIES) {
    if (c.code === clean) return c.code;
    if (clean.includes(c.nameAr.toLowerCase()) || clean.includes(c.nameEn.toLowerCase())) {
      return c.code;
    }
    if (c.keywords.some((k) => clean.includes(k.toLowerCase()))) {
      return c.code;
    }
  }

  return null;
}

interface CountryFlagImageProps {
  countryCode?: string;
  name?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const CountryFlagImage: React.FC<CountryFlagImageProps> = ({
  countryCode,
  name,
  className = '',
  size = 'md',
}) => {
  const [hasError, setHasError] = useState(false);
  const code = (countryCode || resolveCountryCode(name) || 'un').toLowerCase();

  const sizeClasses = {
    xs: 'w-4 h-3 rounded-[2px]',
    sm: 'w-5 h-3.5 rounded-[3px]',
    md: 'w-6 h-4 rounded-[4px]',
    lg: 'w-8 h-5.5 rounded-[5px]',
  }[size];

  if (hasError || !code || code === 'un') {
    return (
      <div
        className={`inline-flex items-center justify-center bg-slate-100 text-slate-500 border border-slate-200 shrink-0 ${sizeClasses} ${className}`}
        title={name || countryCode || 'Flag'}
      >
        <Globe size={size === 'lg' ? 14 : size === 'md' ? 12 : 10} />
      </div>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={name || code.toUpperCase()}
      title={name || code.toUpperCase()}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`inline-block object-cover border border-black/10 shadow-2xs shrink-0 ${sizeClasses} ${className}`}
    />
  );
};

export default CountryFlagImage;
