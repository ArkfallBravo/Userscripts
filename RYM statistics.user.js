// ==UserScript==
// @name         RYM Statistics
// @version      0.7
// @description  Displays average, standard deviation, Beta distribution fit (α, β), and percentiles for RYM ratings
// @author       Helena S
// @match        https://rateyourmusic.com/release/*
// @match        https://rateyourmusic.com/charts/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none

// ==/UserScript==

(function() {
    'use strict';

    // Global boolean to toggle top means calculation
    const USE_TOP_MEANS = false;
    // Global boolean to toggle percentiles calculation
    const USE_PERCENTILES = true;
    // Global boolean to toggle NPS calculation
    const USE_NPS = false;
    // Global boolean to toggle Wilson Lower Bound calculation
    const USE_WILSON_LB = false;
    // Global boolean to toggle RMS average display
    const USE_RMS_AVG = false;
    // Global boolean to toggle cumulative percentages display
    const USE_CUMULATIVE = false;
    // Global boolean to toggle weighted percentages display
    const USE_WEIGHTED_PCT = false;
    // Global boolean to toggle exact percentages display
    const USE_EXACT_PCT = false;
    // Global boolean to toggle 50th percentile (median) display in rating line
    const USE_P50 = false;
    // Global Wilson Lower Bound confidence interval (e.g., 0.95 for 95% confidence)
    const WILSON_CONFIDENCE = 0.90;

    const USE_BETA = false; // Toggle beta distribution display
    const USE_BETA_WEIGHTED = true; // Toggle α²/(β²(α+β)) display
    const USE_BETA_PREDICTIONS = false; // Toggle beta distribution predictions display

    // Global NPS threshold scores
    const NPS_PROMOTER_SCORE = 4.5;
    const NPS_DETRACTOR_SCORE = 2.0;

    const TOP_PERCENTAGES = [0.25, 0.5, 0.75]; // Top 25%, 50%, and 75%

    // Utility function for string padding
    String.prototype.padLeft = function(width) {
        return this.toString().padStart(width, ' ');
    }

    // Utility function for right-aligned padding
    String.prototype.padRight = function(width) {
        return this.toString().padEnd(width, ' ');
    }

    // ==================== Beta Fit Helpers ====================
    // Compute method-of-moments alpha, beta, and ratio
    function fitBetaParams(allRatings) {
        const n = allRatings.length;
        if (n == 0) return {alpha: 0, beta: 0, ratio: 0, shapeRatio: 0};
        const meanX = allRatings.reduce((sum, v) => sum + v, 0) / n;
        const meanU = (meanX - 0.5) / 4.5;
        const varX = allRatings.reduce((sum, v) => sum + (v - meanX) ** 2, 0) / n;
        const varU = varX / (4.5 * 4.5);
        const common = meanU * (1 - meanU) / varU - 1;
        const alpha = meanU * common;
        const beta  = (1 - meanU) * common;
        const ratio = alpha / beta;
        const shapeRatio = alpha**2 / (beta**2 * (alpha + beta));
        return { alpha, beta, ratio: ratio, shapeRatio };
    }

    // Wilson Lower Bound calculation
    function wilsonLowerBound(p, n, confidence) {
        if (n === 0) return 0;
        const z = Math.abs(normalInv(confidence));
        const phat = p / n;
        const denominator = 1 + z * z / n;
        const center = phat + z * z / (2 * n);
        const spread = z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n);
        return Math.max(0, (center - spread) / denominator);
    }

    // Inverse normal distribution function (approximation)
    function normalInv(p) {
        const a1 = -39.6968302866538;
        const a2 = 220.946098424521;
        const a3 = -275.928510446969;
        const a4 = 138.357751867269;
        const a5 = -30.6647980661472;
        const a6 = 2.50662827745924;
        const b1 = -54.4760987982241;
        const b2 = 161.585836858041;
        const b3 = -155.698979859887;
        const b4 = 66.8013118877197;
        const b5 = -13.2806815528857;
        const c1 = -7.78489400243029E-03;
        const c2 = -0.322396458041136;
        const c3 = -2.40075827716184;
        const c4 = -2.54973253934373;
        const c5 = 4.37466414146497;
        const c6 = 2.93816398269878;
        const d1 = 7.78469570904146E-03;
        const d2 = 0.32246712907004;
        const d3 = 2.445134137143;
        const d4 = 3.75440866190742;
        const p_low = 0.02425;
        const p_high = 1 - p_low;
        let q, r;
        if (p < p_low) {
            q = Math.sqrt(-2 * Math.log(p));
            return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else if (p > p_high) {
            q = Math.sqrt(-2 * Math.log(1 - p));
            return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else {
            q = p - 0.5;
            r = q * q;
            return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
        }
    }

    // Beta function helpers
    function gamma(z) {
        // Lanczos approximation
        const g = 7;
        const p = [
            0.99999999999980993, 676.5203681218851, -1259.1392167224028,
            771.32342877765313, -176.61502916214059, 12.507343278686905,
            -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        ];
        if(z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
        z -= 1;
        let x = p[0];
        for(let i = 1; i < g + 2; i++) x += p[i] / (z + i);
        let t = z + g + 0.5;
        return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
    }

    function betacf(x, a, b) {
        let fpmin = 1e-30, m = 1, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
        if (Math.abs(d) < fpmin) d = fpmin;
        d = 1 / d;
        let h = d;
        for (; m <= 100; m++) {
            let m2 = 2 * m;
            let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < fpmin) d = fpmin;
            c = 1 + aa / c;
            if (Math.abs(c) < fpmin) c = fpmin;
            d = 1 / d;
            h *= d * c;
            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < fpmin) d = fpmin;
            c = 1 + aa / c;
            if (Math.abs(c) < fpmin) c = fpmin;
            d = 1 / d;
            let del = d * c;
            h *= del;
            if (Math.abs(del - 1.0) < 3e-7) break;
        }
        return h;
    }

    function gammaLn(z) {
        // Natural log of gamma function
        const cof = [
            76.18009172947146, -86.50532032941677,
            24.01409824083091, -1.231739572450155,
            0.1208650973866179e-2, -0.5395239384953e-5
        ];
        let x = z;
        let y = x;
        let tmp = x + 5.5;
        tmp -= (x + 0.5) * Math.log(tmp);
        let ser = 1.000000000190015;
        for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
        return Math.log(2.5066282746310005 * ser / x) - tmp;
    }

    function betainc(x, a, b) {
        // Regularized incomplete beta function
        let bt = (x === 0 || x === 1) ? 0 :
            Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));
        if (x < 0 || x > 1) return 0;
        if (x < (a + 1) / (a + b + 2)) {
            return bt * betacf(x, a, b) / a;
        } else {
            return 1 - bt * betacf(1 - x, b, a) / b;
        }
    }

    function calculateStats(rows) {
        // Calculate total ratings and weighted sum
        let totalRatings = 0;
        let weightedSum = 0;
        let squaredSum = 0;
        const allRatings = [];
        rows.forEach(([rating, count]) => {
            totalRatings += count;
            weightedSum += rating * count;
            squaredSum += (rating * rating) * count;
            for (let i = 0; i < count; i++) {
                allRatings.push(rating);
            }
        });

        // Calculate median (p50)
        const sortedRatings = [...allRatings].sort((a, b) => a - b);
        const mid = Math.floor(sortedRatings.length / 2);
        const median = sortedRatings.length % 2 === 0
            ? (sortedRatings[mid - 1] + sortedRatings[mid]) / 2
            : sortedRatings[mid];

        const results = {
            totalRatings,
            weightedAvg: weightedSum / totalRatings,
            rmsAvg: Math.sqrt(squaredSum / totalRatings),
            median
        };
        
        // Fit Beta params if enabled
        if (USE_BETA) {
            const { alpha, beta, ratio, shapeRatio } = fitBetaParams(allRatings);
            results.alpha = alpha;
            results.beta = beta;
            results.alphaBetaRatio = ratio;
            results.shapeRatio = shapeRatio;

            // Calculate Beta distribution predictions
            const scores = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5];
            const betaPredictions = {};
            scores.forEach(score => {
                // Convert score to [0,1] range
                const u = (score - 0.5) / 4.5;
                // Calculate cumulative probability from the right
                const p = betainc(1 - u, beta, alpha);
                betaPredictions[score] = Math.round(p * 100);
            });
            results.betaPredictions = betaPredictions;
        }

        // Calculate means for each percentage if USE_TOP_MEANS is true
        if (USE_TOP_MEANS) {
            TOP_PERCENTAGES.forEach(percentage => {
                const targetCount = totalRatings * percentage;
                let currentCount = 0;
                let topSum = 0;

                // Sorted from highest rating ↓
                const sortedRows = [...rows].sort((a,b)=>b[0]-a[0]);

                for (const [rating, count] of sortedRows) {
                    if (currentCount + count >= targetCount) {
                        const needed = targetCount - currentCount;
                        topSum += rating * needed;
                        currentCount = targetCount;
                        break;
                    }
                    
                    topSum += rating * count;
                    currentCount += count;
                }

                results[`top${percentage * 100}Mean`] = topSum / targetCount;
            });
        }

        // Calculate percentiles and/or Wilson LB if either is enabled
        if (USE_PERCENTILES || USE_WILSON_LB || USE_CUMULATIVE || USE_EXACT_PCT) {
            allRatings.sort((a, b) => b - a); // Sort descending

            if (USE_PERCENTILES || USE_CUMULATIVE || USE_EXACT_PCT) {
                const percentiles = {};
                const scores = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5];
                const total = allRatings.length;
                scores.forEach(score => {
                    // Percentile: percent of ratings >= this score
                    const count = allRatings.filter(r => r >= score).length;
                    percentiles[score] = Math.round((count / total) * 100);
                });
                results.percentiles = percentiles;
            }

            // Calculate weighted percentages if enabled
            if (USE_WEIGHTED_PCT && USE_PERCENTILES) {
                const scores = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5];
                const n = scores.length;
                const weights = scores.map((_, i) => 1 << (n-1-i));
                const weightedAtEach = {};
                
                scores.forEach((score, i) => {
                    const sliceW = weights.slice(0, i+1);
                    const sliceS = scores.slice(0, i+1);
                    const Wsum = sliceW.reduce((a,b) => a+b, 0);
                    const Ssum = sliceS.reduce((acc, s, j) => 
                        acc + results.percentiles[s] * sliceW[j]
                    , 0);
                    weightedAtEach[score] = Math.round(Ssum / Wsum * (i+1));
                });
                
                results.weightedPct = weightedAtEach;
            }

            if (USE_WILSON_LB) {
                const wilsonLB = {};
                const scores = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5];
                const total = allRatings.length;
                scores.forEach(score => {
                    const count = allRatings.filter(r => r >= score).length;
                    const wlb = wilsonLowerBound(count, total, WILSON_CONFIDENCE);
                    wilsonLB[score] = Math.round(wlb * 100);
                });
                results.wilsonLB = wilsonLB;
            }
        }

        return results;
    }

    function displayStats(element, stats) {
        // Show p50 (median) inline with the rating
        if (USE_P50 && stats.median !== undefined) {
            element.innerHTML += `, p50 = ${stats.median.toFixed(1)}`;
        }

        // Show averages
        if (USE_RMS_AVG) {
            element.innerHTML +=
                `<br><pre style="font-family:monospace;margin:0;font-size:13px;">avg: ${stats.weightedAvg.toFixed(2)}  rms: ${stats.rmsAvg.toFixed(2)}</pre>`;
        }

        // Show fitted Beta parameters if enabled
        if (USE_BETA && stats.alpha !== undefined && stats.beta !== undefined) {
            const a = stats.alpha.toFixed(2);
            const b = stats.beta.toFixed(2);
            const r = stats.alphaBetaRatio.toFixed(2);
            const sr = stats.shapeRatio.toFixed(2);

            const betaPadTopRight = 10;
            const betaPadTopLeft = 5;
            const betaPadBotLeft = betaPadTopRight * 3;
            const betaLineTop = `α: ${a.padLeft(betaPadTopLeft)}`.padRight(betaPadTopRight) + `β: ${b.padLeft(betaPadTopLeft)}`.padRight(betaPadTopRight) + `α/β: ${r.padLeft(betaPadTopLeft)}`.padRight(betaPadTopRight)
            const betaLineBot = `α²/(β²(α+β)) : ${sr.padLeft(betaPadTopLeft)}`.padLeft(betaPadBotLeft)

            if (USE_BETA_WEIGHTED) {
              element.innerHTML += `<br><pre style="font-family:monospace;margin:0;font-size:13px;">${betaLineTop}\n${betaLineBot}</pre>`;
            } else {
              element.innerHTML += `<br><pre style="font-family:monospace;margin:0;font-size:13px;">${betaLineTop}</pre>`;
            }
        }

        if (USE_TOP_MEANS) {
            const percentages = TOP_PERCENTAGES.map(p => Math.round(p * 100)).join('% / ');
            const values = TOP_PERCENTAGES.map(p => stats[`top${p * 100}Mean`].toFixed(2)).join(' / ');
            element.innerHTML += `<br>(Top ${percentages}%:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${values})`;
        }

        // Display NPS if enabled
        if (USE_NPS && USE_PERCENTILES) {
            const promoterPercentile = stats.percentiles[NPS_PROMOTER_SCORE] || 0;
            const detractorPercentile = 100 - (stats.percentiles[NPS_DETRACTOR_SCORE +.5] || 0);
            const nps = promoterPercentile - detractorPercentile;
            element.innerHTML += `<br><pre style="font-family:monospace;margin:0;font-size:13px;">NPS ${NPS_PROMOTER_SCORE.toFixed(1)}-${NPS_DETRACTOR_SCORE.toFixed(1)}: ${nps}</pre>`;
            
            // Display Wilson LB-adjusted NPS if enabled
            if (USE_WILSON_LB) {
                const wlbPromoter = stats.wilsonLB[NPS_PROMOTER_SCORE] || 0;
                const wlbDetractor = 100 - (stats.wilsonLB[NPS_DETRACTOR_SCORE +.5] || 0);
                const wlbNps = wlbPromoter - wlbDetractor;
                element.innerHTML += `<pre style="font-family:monospace;margin:0;font-size:13px;">Wilson LB-adjusted NPS ${NPS_PROMOTER_SCORE.toFixed(1)}-${NPS_DETRACTOR_SCORE.toFixed(1)} = ${wlbNps}</pre>`;
            }
        }

        // Display percentiles and/or Wilson LB
        if (USE_PERCENTILES || USE_WILSON_LB || USE_CUMULATIVE || USE_EXACT_PCT) {
            // Split into two rows
            const scoresTop = [5.0, 4.5, 4.0, 3.5, 3.0];
            const scoresBot = [2.5, 2.0, 1.5, 1.0, 0.5];
            
            const scorePad = 6;
            const numberPad = 4;
            
            // Format lines with aligned colons and slashes
            const scoreLineTop = 'score:'.padLeft(scorePad) + scoresTop
                                                              .map(s => s.toFixed(1).padLeft(numberPad))
                                                              .join(' /');
            const scoreLineBot = 'score:'.padLeft(scorePad)
                                  + scoresBot.map(s => s.toFixed(1).padLeft(numberPad)).join(' /');

            let percentileLineTop = '';
            let percentileLineBot = '';
            let cumulativeLineTop = '';
            let cumulativeLineBot = '';
            let wilsonLineTop = '';
            let wilsonLineBot = '';
            let wilsonCumulLineTop = '';
            let wilsonCumulLineBot = '';
            let betaLineTop = '';
            let betaLineBot = '';
            let weightedLineTop = '';
            let weightedLineBot = '';

            // Calculate exact percentages per rating
            let exactLineTop = '', exactLineBot = '';
            if (USE_EXACT_PCT) {
                // flatten into one array so indices align
                const allScores = [...scoresTop, ...scoresBot];
                // build exact percentages by difference of cum-% thresholds
                const exact = {};
                allScores.forEach((s,i) => {
                    exact[s] = i === 0
                        ? stats.percentiles[s]
                        : stats.percentiles[s] - stats.percentiles[allScores[i-1]];
                });
                // format top row (5.0…3.0)
                exactLineTop = '%:'.padLeft(scorePad)
                    + scoresTop.map(s => exact[s].toString().padLeft(numberPad)).join(' /');
                // format bottom row (2.5…0.5)
                exactLineBot = '%:'.padLeft(scorePad)
                    + scoresBot.map(s => exact[s].toString().padLeft(numberPad)).join(' /');
            }

            if (USE_PERCENTILES || USE_CUMULATIVE) {
                if (USE_PERCENTILES) {
                    percentileLineTop = 'pct:'.padLeft(scorePad) + scoresTop
                                                          .map(s => stats.percentiles[s].toString().padLeft(numberPad))
                                                          .join(' /');
                    percentileLineBot = 'pct:'.padLeft(scorePad) + scoresBot
                                                          .map(s => stats.percentiles[s].toString().padLeft(numberPad))
                                                          .join(' /');
                }

                // Display weighted percentages if enabled
                if (USE_WEIGHTED_PCT && stats.weightedPct) {
                    weightedLineTop = 'wt:'.padLeft(scorePad) + scoresTop
                                                          .map(s => stats.weightedPct[s].toString().padLeft(numberPad))
                                                          .join(' /');
                    weightedLineBot = 'wt:'.padLeft(scorePad) + scoresBot
                                                          .map(s => stats.weightedPct[s].toString().padLeft(numberPad))
                                                          .join(' /');
                }

                // Calculate cumulative percentages if enabled
                if (USE_CUMULATIVE) {
                    const allScores = [...scoresTop, ...scoresBot];
                    const cumulative = {};
                    let runningSum = 0;
                    allScores.forEach(score => {
                        runningSum += stats.percentiles[score];
                        cumulative[score] = runningSum;
                    });

                    cumulativeLineTop = 'cumul:'.padLeft(scorePad) + scoresTop
                                                              .map(s => cumulative[s].toString().padLeft(numberPad))
                                                              .join(' /');
                    cumulativeLineBot = 'cumul:'.padLeft(scorePad) + scoresBot
                                                              .map(s => cumulative[s].toString().padLeft(numberPad))
                                                              .join(' /');
                }
            }

            if (USE_WILSON_LB) {
                wilsonLineTop = 'WLB p:'.padLeft(scorePad) + scoresTop
                                                      .map(s => stats.wilsonLB[s].toString().padLeft(numberPad))
                                                      .join(' /');
                wilsonLineBot = 'WLB p:'.padLeft(scorePad) + scoresBot
                                                      .map(s => stats.wilsonLB[s].toString().padLeft(numberPad))
                                                      .join(' /');

                // Calculate Wilson LB cumulative if cumulative is enabled
                if (USE_CUMULATIVE) {
                    const allScores = [...scoresTop, ...scoresBot];
                    const wilsonCumulative = {};
                    let runningSum = 0;
                    allScores.forEach(score => {
                        runningSum += stats.wilsonLB[score];
                        wilsonCumulative[score] = runningSum;
                    });

                    wilsonCumulLineTop = 'cumul:'.padLeft(scorePad) + scoresTop
                                                              .map(s => wilsonCumulative[s].toString().padLeft(numberPad))
                                                              .join(' /');
                    wilsonCumulLineBot = 'cumul:'.padLeft(scorePad) + scoresBot
                                                              .map(s => wilsonCumulative[s].toString().padLeft(numberPad))
                                                              .join(' /');
                }
            }

            // Add Beta predictions if enabled
            if (USE_BETA && USE_BETA_PREDICTIONS && stats.betaPredictions) {
                betaLineTop = 'beta:'.padLeft(scorePad) + scoresTop
                                                      .map(s => stats.betaPredictions[s].toString().padLeft(numberPad))
                                                      .join(' /');
                betaLineBot = 'beta:'.padLeft(scorePad) + scoresBot
                                                      .map(s => stats.betaPredictions[s].toString().padLeft(numberPad))
                                                      .join(' /');
            }

            // Use <pre> for alignment
            element.innerHTML += `<br><pre style="font-family:monospace;margin:0;font-size:13px;">${scoreLineTop}${percentileLineTop ? '\n' + percentileLineTop : ''}${exactLineTop ? '\n' + exactLineTop : ''}${weightedLineTop ? '\n' + weightedLineTop : ''}${betaLineTop ? '\n' + betaLineTop : ''}${cumulativeLineTop ? '\n' + cumulativeLineTop : ''}${wilsonLineTop ? '\n' + wilsonLineTop : ''}${wilsonCumulLineTop ? '\n' + wilsonCumulLineTop : ''}\n\n${scoreLineBot}${percentileLineBot ? '\n' + percentileLineBot : ''}${exactLineBot ? '\n' + exactLineBot : ''}${weightedLineBot ? '\n' + weightedLineBot : ''}${betaLineBot ? '\n' + betaLineBot : ''}${cumulativeLineBot ? '\n' + cumulativeLineBot : ''}${wilsonLineBot ? '\n' + wilsonLineBot : ''}${wilsonCumulLineBot ? '\n' + wilsonCumulLineBot : ''}</pre>`;
        }
    }

    function processReleasePage() {
        // Get the script containing the rating data
        const js = Array.from(document.querySelectorAll('#chart_div + script'))
            .map(s => s.textContent)
            .find(t => t.includes('addRows'));
        if (!js) return console.log('No addRows script found');

        // Extract the array literal
        const m = js.match(/addRows\(\s*\[\s*([\s\S]*?)\]\s*\)/);
        if (!m) return console.log('Pattern not matched');

        // Build rows = [[rating, count], …]
        const rows = m[1]
            .split(/\],\s*\[/)
            .map(s => s.replace(/[\[\]]/g,'').split(',').map(Number));

        const stats = calculateStats(rows);
        const numRatingsElement = document.querySelector('.num_ratings');
        displayStats(numRatingsElement, stats);
    }

    function processChartPage() {
        const chartItems = document.querySelectorAll('.page_charts_section_charts_item');
        
        chartItems.forEach(async (item) => {
            const link = item.querySelector('.page_charts_section_charts_item_link');
            if (!link) return;

            const releaseUrl = link.href;
            try {
                const response = await fetch(releaseUrl);
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                const js = Array.from(doc.querySelectorAll('#chart_div + script'))
                    .map(s => s.textContent)
                    .find(t => t.includes('addRows'));

                if (!js) return;

                const m = js.match(/addRows\(\s*\[\s*([\s\S]*?)\]\s*\)/);
                if (!m) return;

                const rows = m[1]
                    .split(/\],\s*\[/)
                    .map(s => s.replace(/[\[\]]/g,'').split(',').map(Number));

                const stats = calculateStats(rows);
                const titleElement = item.querySelector('.ui_name_locale_original');
                if (titleElement) {
                    displayStats(titleElement, stats);
                }
            } catch (error) {
                console.error('Error processing release:', error);
            }
        });
    }

    // Determine which page we're on and process accordingly
    setTimeout(() => {
        if (window.location.pathname.startsWith('/release/')) {
            processReleasePage();
        } else if (window.location.pathname.startsWith('/charts/')) {
            // processChartPage();
        }
    }, 1000);
})();