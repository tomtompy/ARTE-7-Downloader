// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     http://*.arte.tv/*
// @version     2.2.2
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        https://icons.duckduckgo.com/ip2/www.arte.tv.ico
// ==/UserScript==

/*
    @TODO
    - Arte future overlay: http://future.arte.tv/fr/polar-sea-360deg-les-episodes
    - Arte cinema overlay: http://cinema.arte.tv/fr/program/jude
    - Arte creative double decoration: http://creative.arte.tv/fr/episode/bonjour-afghanistan
    - Arte info triple decoration: http://info.arte.tv/fr/videos?id=71611
    - Arte info journal overlay: http://info.arte.tv/fr/emissions/arte-journal
*/

// Set this to 1 to enable console logs.
var debug_mode = 1;
if (!debug_mode) {
    console.log('GM debug mode disabled');
    console.log = function () { };
}
else {
    console.log('GM debug mode enabled');
}

// TODO: struct array instead of this garbage
// eg.: player[i].nbHTTP
var playerJson = null;
var nbVideos;
var nbHTTP;
var nbRTMP;
var nbHLS;

var videoPlayer = {
    '+7': 'arte_vp_url',
    'live': 'arte_vp_live-url',
    'generic': 'data-url',
    'teaser': 'data-teaser-url'
};

var qualityCode = {
    '216p (300 kbps)': 'MQ', // 300 kbps
    '406p (800 kbps)': 'HQ', // 800 kbps
    '406p (1500 kbps)': 'EQ', // 1500 kbps
    '720p (2200 kbps)': 'SQ' // 2200 kbps
};

// Reference languages object
var languages = {
    // 'versionCode'    : 'language'
    'VO': 'Original',
    'VO-STF': 'Original subtitled in french',
    'VA-STA': 'German dubbed subtitled',
    'VF-STF': 'French dubbed subtitled',
    'VOF': 'Original in french',
    'VOA': 'Original in german',
    'VOF-STF': 'Original in french subtitled',
    'VOF-STA': 'Original in french subtitled in german',
    'VF': 'French dubbed',
    'VA': 'German dubbed',
    'VOA-STA': 'Original in german subtitled',
    'VOA-STF': 'Original in german subtitled in french',
    'VOF-STMF': 'Original in french for hearing impaired',
    'VOA-STMA': 'Original in german for hearing impaired',
    'VFAUD': 'French with audio description',
    'VAAUD': 'German with audio description'
};

var availableLanguages;

function addLanguage(videoElementIndex, language) {
    if (availableLanguages[videoElementIndex][language] === 0) {
        availableLanguages[videoElementIndex][language] = languages[language];
    }
}

function preParsePlayerJson(videoElementIndex) {
    if (playerJson) {
        var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);
        var video = null;
        nbVideos[videoElementIndex] = videos.length;

        // Loop through all videos URLs.
        for (var key in videos) {
            video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format or media type
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {
                nbHTTP[videoElementIndex]++;
                //console.log(nbHTTP[videoElementIndex]);
            }
            else if (video["videoFormat"] === "RMP4") {
                nbRTMP[videoElementIndex]++;
            }
            else if (video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") {
                nbHLS[videoElementIndex]++;
            }

            // Add the language
            addLanguage(videoElementIndex, video["versionCode"]);
            //console.log(video["versionCode"]) // find new lang tags
        }

        console.log("\n====================================\n              player #" + videoElementIndex + "\n====================================\n> "
            + nbVideos[videoElementIndex] + " formats:\n- "
            + nbHTTP[videoElementIndex] + " HTTP videos,\n- "
            + nbRTMP[videoElementIndex] + " RTMP streams,\n- "
            + nbHLS[videoElementIndex] + " HLS streams.");
        console.log("> Languages:");
        for (l in availableLanguages[videoElementIndex]) {
            if (availableLanguages[videoElementIndex][l] !== 0) {
                console.log("- " + availableLanguages[videoElementIndex][l]);
            }
        }
    }
}

function createButton(videoElementIndex, quality, language) {
    var button = document.createElement('a');
    var videoUrl = getVideoUrl(videoElementIndex, qualityCode[quality], language);

    // Check if video exists
    if (videoUrl === null) {
        // Don't create button
        return null;
    }

    // Check RTMP stream
    if (nbRTMP[videoElementIndex] > 0 && videoUrl.substring(0, 7) === "rtmp://") { // because ends with .mp4 like HTTP
        button.innerHTML = quality + " Quality <a href='https://en.wikipedia.org/wiki/Real_Time_Messaging_Protocol'>RTMP stream</a> (copy/paste this link into<a href='https://www.videolan.org/vlc/'> VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HTTP
    else if (nbHTTP[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 4, videoUrl.length) === ".mp4") {
        button.innerHTML = quality + " <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HLS stream : should not happen
    else if (nbHLS[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 5, videoUrl.length === ".m3u8")) {
        button.innerHTML = quality + "<a href='https://en.wikipedia.org/wiki/HTTP_Live_Streaming'> HLS master stream</a> (copy/paste into Apple Quicktime or <a href='https://www.videolan.org/vlc/'>into VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Unknown URL format : should not happen
    else {
        console.log('Unknown URL format');
        return null;
    }

    button.setAttribute('id', 'btnDownload' + videoElementIndex + qualityCode[quality]); // to refer later in select changes
    button.setAttribute('href', videoUrl);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', getVideoName(quality));

    // Keeping uniform style
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return button;
}

function createButtonMetadata(element) {
    var button = document.createElement('a');

    // Keeping uniform style
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell; color:rgb(40, 40, 40);  background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    button.innerHTML = "<strong>Metadata</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";

    var metadata = getMetadata(playerJson);

    // Properly encode to Base 64.
    var encodedData = window.btoa(unescape(encodeURIComponent(metadata)));

    // The href will output a text file. 
    // For a CSV file, that would be: data:application/octet-stream,field1%2Cfield2%0Afoo%2Cbar%0Agoo%2Cgai%0A
    button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', 'metadata.txt');

    return button;
}

function createLanguageComboBox(videoElementIndex) {
    var languageComboBox = document.createElement('select');

    // Associate onchange event with function (bypass for GM)
    languageComboBox.onchange = function () {
        var newLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
        console.log("\n> Language changed to " + newLanguage);
        for (key in qualityCode) {
            var btn = document.getElementById('btnDownload' + videoElementIndex + qualityCode[key]);
            var url = getVideoUrl(videoElementIndex, qualityCode[key], newLanguage);
            btn.setAttribute('href', url);
        }
    };

    for (l in availableLanguages[videoElementIndex]) {
        if (availableLanguages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + availableLanguages[videoElementIndex][l] + "</option>";
        }
    }

    // Keeping uniform style
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', 'width:97%; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');

    return languageComboBox;
}

function createButtons(videoElement, videoElementIndex) {
    console.log("\n");

    // container
    var parent = videoElement.parentNode.parentNode;
    var container = document.createElement('div');
    parent.appendChild(container);
    container.setAttribute('style', 'display: table; width: 100%;');

    // language combobox
    var languageComboBox = createLanguageComboBox(videoElementIndex)
    container.appendChild(languageComboBox);
    var selectedLanguage;

    // Check if there are languages available to select
    if (languageComboBox.options.length > 0) {
        selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
    }

    // download buttons
    container.appendChild(createButtonMetadata(videoElement)); // @TODO display instead of download

    var tempButton = createButton(videoElementIndex, '216p (300 kbps)', selectedLanguage)
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }
    tempButton = createButton(videoElementIndex, '406p (800 kbps)', selectedLanguage);
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }
    tempButton = createButton(videoElementIndex, '406p (1500 kbps)', selectedLanguage);
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }
    tempButton = createButton(videoElementIndex, '720p (2200 kbps)', selectedLanguage);
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }

    // credit
    var credit = document.createElement('div');
    credit.setAttribute('style', 'width: 100%; text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 3px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credit.innerHTML = 'Arte Downloader v.' + GM_info.script.version
                    + ' built by and for the community with love'
                    + '<br /><a style=\'color: #020202;\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    parent.appendChild(credit);
}

function parsePlayerJson(playerUrl, videoElement, videoElementIndex) {
    console.log('- #' + videoElementIndex + ' player JSON: ' + playerUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: playerUrl,
        onload: function (response) {
            playerJson = JSON.parse(response.responseText);
            preParsePlayerJson(videoElementIndex);
            createButtons(videoElement, videoElementIndex);
        }
    });
}

// Decorates a video with download buttons
function decorateVideo(videoElement, videoElementIndex) {

    // Get player URL
    var playerUrl = videoElement.getAttribute(videoPlayer['+7']);
    // If no URL found, try livestream tag
    if (playerUrl === null) {
        playerUrl = videoElement.getAttribute(videoPlayer['live']);

        // Generic tag
        if (playerUrl === null) {
            playerUrl = videoElement.getAttribute(videoPlayer['generic']);
            if (playerUrl === null) {
                playerUrl = videoElement.getAttribute(videoPlayer['teaser']);
            }

            parsePlayerJson(playerUrl, videoElement, videoElementIndex);
        }
    }

    // Check if player URL points to a JSON
    if (playerUrl.substring(playerUrl.length - 6, playerUrl.length - 1) === ".json") {
        console.log("TRYEE")
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
    } else {

        // Find the player JSON in the URL
        GM_xmlhttpRequest(
            {
                method: "GET",
                url: playerUrl,
                onload: function (response) {

                    // Look for player URL inside the livestream player URL
                    var json = JSON.parse(response.responseText);
                    playerUrl = json["videoJsonPlayer"]["videoPlayerUrl"];

                    // not found ? Look for playlist file inside the livestream player
                    if (playerUrl === undefined) {
                        console.log("Video player URL not available. Fetching livestream player URL");
                        playerUrl = videoElement.getAttribute(videoPlayer['live']);
                    }
                    parsePlayerJson(playerUrl, videoElement, videoElementIndex);
                    s
                }
            }
        );
    }
};

/*
 * Parse the content of the JSON file and extract the video name.
 */
function getVideoName(quality) {
    var name;
    name = (playerJson['videoJsonPlayer']['VTI']);
    if (name === null) {
        name = (playerJson['videoJsonPlayer']['VST']['VNA']);
    }
    name = name.split('_').join(' ');
    return '[' + quality.toUpperCase() + '] ' + name.charAt(0).toUpperCase() + name.slice(1) + '.mp4';
}

/*
 * Parse the content of the JSON file and extract the metadata informations.
 */
function getMetadata() {
    return playerJson['videoJsonPlayer']['V7T'] + '\n\n' + playerJson['videoJsonPlayer']['VDE'] + '\n\n' + playerJson['videoJsonPlayer']['VTA'];
}

/*
 * Parse the content of the JSON file and extract the MP4 videos URLs in the required language.
 * @TODO : parse once the .json
 */
function getVideoUrl(videoElementIndex, quality, language) {
    console.log("> Looking for a " + quality + " quality track in " + language)

    // Get videos object
    var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);

    // Check if there are HTTP videos
    if (nbHTTP[videoElementIndex] > 0) {

        // Loop through all videos URLs.
        for (var key in videos) {
            var video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format is "HBBTV" (HTTP).
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {

                // Check language
                if (video["versionCode"] === language) {

                    // Get the video URL using the requested quality.
                    if (video["VQU"] === quality || video["quality"] === quality) {
                        var url = video["url"];
                        console.log("Found a " + quality + " quality MP4 in " + language + ": " + url);
                        return (url);
                    }
                }
            }
        }
    }

    // Search RTMP streams
    if (nbRTMP[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];
            if (video["videoFormat"] === "RMP4" && (video["VQU"] === quality || video["quality"] === quality)) {
                var url = video["streamer"] + video["url"];
                console.log("Found a RTMP stream: " + url);
                return (url);
            }
        }
    }

    // Search HLS streams (should not at that point, but we never know)
    if (nbHLS[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];
            if ((video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") && (video["VQU"] === quality || video["quality"] === quality)) {
                var url = video["url"];
                console.log("Found a HLS stream: " + url);
                return (url);
            }
        }
    }

    // No video feed
    console.log("...not found.")
    return null;
}

/*
 * main: script entry
 */
main();

function main() {
    var videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['live'] + "]");

    // Check if not a livestream
    if (videoPlayerElements.length === 0) {
        videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['+7'] + "]");

        // Check Creative 
        if (videoPlayerElements.length === 0) {
            videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['generic'] + "]");

            // Check info
            if (videoPlayerElements.length === 0) {
                videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['teaser'] + "]");

            }
        }
    }

    var nbVideoPlayers = videoPlayerElements.length
    console.log("Found " + nbVideoPlayers + " video players");

    // Initialize players info arrays
    nbVideos = new Array(nbVideoPlayers);
    nbHTTP = new Array(nbVideoPlayers);
    nbRTMP = new Array(nbVideoPlayers);
    nbHLS = new Array(nbVideoPlayers);
    availableLanguages = new Array(nbVideoPlayers);
    for (i = 0; i < nbVideoPlayers; i++) {
        nbVideos[i] = 0;
        nbHTTP[i] = 0;
        nbRTMP[i] = 0;
        nbHLS[i] = 0;

        // Clone from base object
        availableLanguages[i] = Object.assign({}, languages);

        // Resets
        for (l in availableLanguages[i]) {
            availableLanguages[i][l] = 0;
        }
    }

    // Inject buttons in the video's face
    for (var i = 0; i < nbVideoPlayers; i++) {
        decorateVideo(videoPlayerElements[i], i);
    }
}