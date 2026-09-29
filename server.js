const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { MOVIES } = require('@consumet/extensions');

const app = express();

// السماح لموقعك بالاتصال بالسيرفر بدون مشاكل CORS
app.use(cors());

// مفتاح TMDB الخاص بك
const TMDB_API_KEY = "fca02c6813f7dc2ace00bca1009e315a";

// تهيئة مكتبة استخراج الروابط (نستخدم FlixHQ كمصدر ممتاز بدون إعلانات)
const flixhq = new MOVIES.FlixHQ();

// مسار فحص حالة السيرفر
app.get('/', (req, res) => {
    res.send('EfrînFlix Server is Running! 🚀');
});

// مسار جلب البث المباشر
app.get('/stream', async (req, res) => {
    const { tmdbId, type, s, e } = req.query;

    if (!tmdbId || !type) {
        return res.status(400).send("الرجاء تمرير tmdbId و type");
    }

    try {
        // 1. جلب اسم العمل باللغة الإنجليزية من TMDB للبحث عنه بدقة
        const tmdbUrl = type === 'movie' 
            ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
            : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
        
        const tmdbRes = await axios.get(tmdbUrl);
        // استخدام الاسم الأصلي (الإنجليزي) لضمان نجاح البحث في السيرفرات الأجنبية
        const searchQuery = type === 'movie' ? tmdbRes.data.original_title : tmdbRes.data.original_name;

        // 2. البحث عن العمل في خوادم FlixHQ
        const searchResults = await flixhq.search(searchQuery);
        if (!searchResults.results || searchResults.results.length === 0) {
            return res.status(404).send("لم يتم العثور على العمل في سيرفرات البث.");
        }

        // أخذ أول نتيجة مطابقة
        const mediaId = searchResults.results[0].id;

        // 3. جلب معلومات الحلقات أو الفيلم
        const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
        let episodeId = null;

        if (type === 'movie') {
            episodeId = mediaInfo.episodes[0].id;
        } else {
            // البحث عن الحلقة المطلوبة للموسم المحدد
            const targetEpisode = mediaInfo.episodes.find(
                (ep) => ep.season == s && ep.number == e
            );
            if (!targetEpisode) return res.status(404).send("لم يتم العثور على الحلقة.");
            episodeId = targetEpisode.id;
        }

        // 4. استخراج الروابط النقية
        const streamInfo = await flixhq.fetchEpisodeSources(episodeId, mediaId);
        
        // البحث عن أعلى جودة متوفرة، أو الجودة التلقائية (auto)
        const bestQuality = streamInfo.sources.find(src => src.quality === 'auto' || src.quality === '1080p') || streamInfo.sources[0];

        // 5. تحويل المتصفح فوراً إلى الرابط الخام ليعمل داخل الـ <video>
        res.redirect(bestQuality.url);

    } catch (error) {
        console.error("خطأ في السيرفر:", error.message);
        res.status(500).send("حدث خطأ داخلي أثناء معالجة الفيديو.");
    }
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
