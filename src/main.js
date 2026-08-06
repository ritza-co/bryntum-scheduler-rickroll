import { DateHelper, EventModel, Scheduler, StringHelper } from '@bryntum/scheduler';
import './style.css';

class VideoEventModel extends EventModel {
    static $name  = 'VideoEventModel';
    static fields = [
        { name : 'videoColor', defaultValue : 'rgb(0 0 0)' },
        { name : 'videoTextColor', defaultValue : 'white' },
        { name : 'videoStart', defaultValue : 0 },
        { name : 'videoEnd', defaultValue : 0 },
        { name : 'videoVisible', defaultValue : false },
        { name : 'videoLabelled', defaultValue : false },
        { name : 'videoSplashBackground', defaultValue : false },
        { name : 'videoSplashLogo', defaultValue : false }
    ];
}

const
    // The 86 × 48 sample grid retains considerably more detail than the original while keeping the moving event pool
    // small enough for smooth playback. Scheduler stretches those samples to fill all available demo space.
    sampleColumns         = 86,
    sampleRows            = 48,
    maximumSegmentsPerRow = 20,
    maximumFrameRate      = 30,
    eventCount            = sampleRows * maximumSegmentsPerRow,
    displayStartDate      = new Date(2026, 6, 1),
    displayEndDate        = DateHelper.add(displayStartDate, sampleColumns, 'day'),
    canvas                = document.createElement('canvas'),
    context               = canvas.getContext('2d', { willReadFrequently : true }),
    video                 = document.createElement('video'),
    staffMembers          = [
        'Aisha Khan', 'Liam O\'Connor', 'Sofia Martinez', 'Daniel Kim', 'Priya Sharma', 'Marcus Johnson',
        'Elena Petrova', 'Noah Williams', 'Mei Lin', 'Oliver Brown', 'Fatima Zahra', 'Ethan Nguyen',
        'Maya Patel', 'Lucas Silva', 'Amara Okafor', 'Hugo Laurent', 'Yasmin Haddad', 'Benjamin Clark',
        'Chloe Dubois', 'Rafael Costa', 'Nina Kowalski', 'Samuel Mensah', 'Isabel Romero', 'Jack Thompson',
        'Hana Suzuki', 'Adam Nowak', 'Leila Mansour', 'Felix Weber', 'Zoe Chen', 'Omar Farouk',
        'Grace Wilson', 'Mateo Alvarez', 'Ingrid Larsen', 'Theo Martin', 'Rania Saleh', 'Jonah Miller',
        'Lucia Bianchi', 'Caleb Davis', 'Anika Rao', 'Victor Santos', 'Sara Ibrahim', 'Leo Andersen',
        'Emily Carter', 'Arjun Mehta', 'Miriam Cohen', 'David Park', 'Layla Hassan', 'Thomas Evans'
    ],
    sampleEventNames      = [
        'Daily product stand-up', 'Platform roadmap review', 'Quarterly budget planning',
        'Mobile design critique', 'Customer onboarding call', 'Sales pipeline review',
        'Engineering retrospective', 'Sprint planning session', 'Marketing campaign kickoff',
        'Leadership team sync', 'Hiring panel interview', 'Weekly manager check-in',
        'Security incident review', 'Partner integration workshop', 'Finance forecast update',
        'Accessibility audit readout', 'Release readiness review', 'Customer success handoff',
        'Architecture review board', 'Brand strategy workshop', 'Research findings presentation',
        'Recruiting debrief', 'Legal contract review', 'Operations planning session',
        'Analytics dashboard demo', 'Vendor selection discussion', 'Content calendar planning',
        'Product metrics review', 'Infrastructure capacity planning', 'Support escalation triage',
        'New starter orientation', 'Design system office hours', 'Executive business review',
        'Localization planning workshop', 'Data governance council', 'Quality assurance kickoff',
        'Account renewal discussion', 'Compensation review calibration', 'Community program update',
        'Procurement approval meeting', 'Performance testing readout', 'Go-to-market planning',
        'API migration workshop', 'Client discovery interview', 'Monthly finance close',
        'Partner enablement training', 'Feature prioritization session', 'Risk register review',
        'Board presentation rehearsal', 'Website launch checkpoint', 'People operations sync',
        'Revenue forecast review', 'Incident response tabletop', 'Customer feedback review',
        'Demand generation planning', 'Engineering all-hands', 'UX research interview',
        'Compliance audit briefing', 'Regional sales update', 'Product launch retrospective',
        'Data privacy review', 'Campaign creative review', 'Service reliability check-in',
        'Mentorship program kickoff', 'Annual planning workshop', 'Contract renewal call',
        'Technical discovery session', 'Portfolio health review', 'Pricing strategy discussion',
        'Employee experience workshop', 'Cloud cost review', 'Release train planning'
    ],
    meetingRooms          = [
        'Boardroom', 'Orchid room', 'Maple room', 'Studio A', 'Focus room', 'Library', 'Town hall', 'Zoom',
        'Google Meet', 'Microsoft Teams', 'Client suite', 'Innovation lab'
    ],
    // Letterbox bars are painted with this before each frame is drawn on top of it.
    blackFill             = 'rgb(0 0 0)',
    splashBackgroundColor = 'var(--b-color-blue)',
    splashLogoColor       = 'white',
    splashLogoMarker      = '#',
    splashAnimationTime   = 900,
    splashLogoAspectRatio = 354.9 / 144.52,
    resources             = staffMembers.map((name, row) => ({
        id : `row-${row}`,
        name
    })),
    events                = Array.from({ length : eventCount }, (value, index) => {
        const row = Math.floor(index / maximumSegmentsPerRow);

        return {
            id         : index + 1,
            resourceId : `row-${row}`,
            startDate  : displayStartDate,
            endDate    : displayEndDate,
            name       : sampleEventNames[index % sampleEventNames.length]
        };
    }),
    regionStates          = Array.from({ length : eventCount }, () => ({
        color            : 'rgb(0 0 0)',
        end              : 0,
        labelled         : false,
        splashBackground : false,
        splashLogo       : false,
        start            : 0,
        textColor        : 'white',
        visible          : false
    }));

let
    // Rasterize Bryntum's official compact symbol once, then resize it to compensate for non-square Scheduler cells.
    splashLogoBitmap     = createSplashLogoBitmap(76, 31),
    splashLogoTop        = Math.floor((sampleRows - splashLogoBitmap.length) / 2),
    frameRequestId       = null,
    frameRequestType     = null,
    splashFrameRequestId = null,
    lastFrameTime        = -Infinity,
    loadId               = 0,
    objectUrl            = null,
    resizePending        = false,
    resizeObserver;

canvas.width = sampleColumns;
canvas.height = sampleRows;
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'low';

video.loop = true;
video.muted = true;
video.playsInline = true;
video.preload = 'auto';

function createSplashLogoBitmap(width, height) {
    const
        symbolCanvas  = document.createElement('canvas'),
        symbolContext = symbolCanvas.getContext('2d'),
        symbolPath    = new Path2D('m305.63 144.52c-12.47 0-23.53-4.83-31.58-13.28v11.06h-25.54v-142.3h26.75v48.58c7.84-7.64 18.5-12.07 30.37-12.07 27.15 0 49.28 23.33 49.28 54.1s-22.12 53.9-49.28 53.9zm-3.82-83.47c-14.68 0-26.55 13.27-26.55 29.77s11.87 29.16 26.55 29.16 26.55-12.67 26.55-29.16-11.87-29.77-26.55-29.77z'),
        scaleX        = width / 354.9,
        scaleY        = height / 144.52,
        barHeight     = Math.round(29.7 * scaleY);

    symbolCanvas.width = width;
    symbolCanvas.height = height;
    symbolContext.scale(scaleX, scaleY);
    symbolContext.fill(symbolPath);
    symbolContext.resetTransform();
    symbolContext.fillRect(Math.round(148.02 * scaleX), 0, Math.round(74.01 * scaleX), barHeight);
    symbolContext.fillRect(0, Math.round(56.26 * scaleY), Math.round(222.03 * scaleX), barHeight);
    symbolContext.fillRect(Math.round(74.01 * scaleX), Math.round(112.52 * scaleY),
        Math.round(148.02 * scaleX), barHeight);

    const pixels = symbolContext.getImageData(0, 0, width, height).data;

    return Array.from({ length : height }, (value, row) => Array.from({ length : width }, (value, column) =>
        pixels[(row * width + column) * 4 + 3] >= 128 ? splashLogoMarker : ' '
    ).join(''));
}

function setStatus(text, isError = false) {
    const { sourceLabel } = scheduler.widgetMap;

    sourceLabel.text = text;
    sourceLabel[isError ? 'addCls' : 'removeCls']('b-load-error');
}

function updatePlaybackButton(isPlaying) {
    const { playPauseButton } = scheduler.widgetMap;

    playPauseButton.icon = isPlaying ? 'fa fa-pause' : 'fa fa-play';
    playPauseButton.tooltip = isPlaying ? 'Pause video' : 'Play video';
    playPauseButton.ariaLabel = isPlaying ? 'Pause video' : 'Play video';
}

function stopFrameLoop() {
    if (frameRequestId !== null) {
        if (frameRequestType === 'video') {
            video.cancelVideoFrameCallback(frameRequestId);
        }
        else {
            cancelAnimationFrame(frameRequestId);
        }
    }

    frameRequestId = frameRequestType = null;
}

function stopSplashAnimation() {
    if (splashFrameRequestId !== null) {
        cancelAnimationFrame(splashFrameRequestId);
        splashFrameRequestId = null;
    }
}

function getRegionRecordData(state) {
    return {
        videoColor            : state.color,
        videoTextColor        : state.textColor,
        videoStart            : state.start,
        videoEnd              : state.end,
        videoVisible          : state.visible,
        videoLabelled         : state.labelled,
        videoSplashBackground : state.splashBackground,
        videoSplashLogo       : state.splashLogo
    };
}

function updateRegionRecord(index) {
    scheduler.eventStore.getAt(index).set(getRegionRecordData(regionStates[index]));
}

function runEventBatch(updateRecords, updater) {
    if (!updateRecords) {
        updater();
        return;
    }

    scheduler.eventStore.beginBatch();

    try {
        updater();
    }
    finally {
        scheduler.eventStore.endBatch();
    }
}

function colorDistance(first, second) {
    const
        red   = first.red - second.red,
        green = first.green - second.green,
        blue  = first.blue - second.blue;

    return red * red + green * green + blue * blue;
}

function mergeSegments(first, second) {
    const total = first.length + second.length;

    return {
        start  : first.start,
        end    : second.end,
        length : total,
        red    : (first.red * first.length + second.red * second.length) / total,
        green  : (first.green * first.length + second.green * second.length) / total,
        blue   : (first.blue * first.length + second.blue * second.length) / total
    };
}

function compressRow(frame, row) {
    const segments = [];

    let run;

    for (let column = 0; column < sampleColumns; column++) {
        const
            frameIndex   = (row * sampleColumns + column) * 4,
            red          = frame[frameIndex] >> 4,
            green        = frame[frameIndex + 1] >> 4,
            blue         = frame[frameIndex + 2] >> 4,
            paletteIndex = red << 8 | green << 4 | blue;

        if (run?.paletteIndex === paletteIndex) {
            run.end = column + 1;
            run.length++;
        }
        else {
            run = {
                start  : column,
                end    : column + 1,
                length : 1,
                red    : red * 17,
                green  : green * 17,
                blue   : blue * 17,
                paletteIndex
            };
            segments.push(run);
        }
    }

    while (segments.length > maximumSegmentsPerRow) {
        let
            bestIndex = 0,
            bestCost  = Infinity;

        for (let index = 0; index < segments.length - 1; index++) {
            const
                first  = segments[index],
                second = segments[index + 1],
                cost   = colorDistance(first, second) * Math.min(first.length, second.length);

            if (cost < bestCost) {
                bestCost = cost;
                bestIndex = index;
            }
        }

        // Merge the closest neighboring colors. The surviving boundaries become the animated Scheduler event edges.
        segments.splice(bestIndex, 2, mergeSegments(segments[bestIndex], segments[bestIndex + 1]));
    }

    return segments;
}

function applyFrame(frame, updateRecords = true) {
    runEventBatch(updateRecords, () => {
        for (let row = 0; row < sampleRows; row++) {
            const segments = compressRow(frame, row);

            for (let slot = 0; slot < maximumSegmentsPerRow; slot++) {
                const
                    index   = row * maximumSegmentsPerRow + slot,
                    state   = regionStates[index],
                    segment = segments[slot],
                    wasVisible = state.visible;

                if (segment) {
                    const
                        red       = Math.round(segment.red),
                        green     = Math.round(segment.green),
                        blue      = Math.round(segment.blue),
                        color     = `rgb(${red} ${green} ${blue})`,
                        textColor = red * 299 + green * 587 + blue * 114 > 150000 ? '#111' : '#fff',
                        labelled  = segment.length >= 6;

                    if (!wasVisible || state.splashBackground || state.splashLogo ||
                    state.start !== segment.start || state.end !== segment.end ||
                    state.color !== color || state.labelled !== labelled || state.textColor !== textColor) {
                        Object.assign(state, {
                            color,
                            end              : segment.end,
                            labelled,
                            splashBackground : false,
                            splashLogo       : false,
                            start            : segment.start,
                            textColor,
                            visible          : true
                        });
                        if (updateRecords) {
                            updateRegionRecord(index);
                        }
                    }
                }
                else if (wasVisible) {
                    state.visible = false;
                    state.labelled = false;
                    state.splashBackground = false;
                    state.splashLogo = false;
                    if (updateRecords) {
                        updateRegionRecord(index);
                    }
                }
            }
        }
    });
}

// Partition every row into adjoining white and blue runs with no overlapping events. Each call is one animation frame:
// moving the bitmap changes the pooled Scheduler events' colors, positions, widths and visibility.
function applySplashLogoFrame(logoTop, updateRecords = true) {
    const columnOffset = Math.floor((sampleColumns - splashLogoBitmap[0].length) / 2);

    runEventBatch(updateRecords, () => {
        for (let row = 0; row < sampleRows; row++) {
            const
                logoRow   = row - logoTop,
                bitmapRow = row >= logoTop && logoRow < splashLogoBitmap.length ? splashLogoBitmap[logoRow] : '',
                runs      = [];

            let currentRun = null;

            for (let column = 0; column < sampleColumns; column++) {
                const
                    bitmapColumn = column - columnOffset,
                    isLogo       = bitmapRow[bitmapColumn] === splashLogoMarker;

                if (currentRun?.splashLogo === isLogo) {
                    currentRun.end = column + 1;
                }
                else {
                    currentRun = {
                        color            : isLogo ? splashLogoColor : splashBackgroundColor,
                        end              : column + 1,
                        splashBackground : !isLogo,
                        splashLogo       : isLogo,
                        start            : column,
                        textColor        : isLogo ? '#111' : '#fff'
                    };
                    runs.push(currentRun);
                }
            }

            for (let slot = 0; slot < maximumSegmentsPerRow; slot++) {
                const
                    index            = row * maximumSegmentsPerRow + slot,
                    state            = regionStates[index],
                    run              = runs[slot],
                    color            = run?.color ?? splashBackgroundColor,
                    end              = run?.end ?? 0,
                    splashBackground = Boolean(run?.splashBackground),
                    splashLogo       = Boolean(run?.splashLogo),
                    start            = run?.start ?? 0,
                    textColor        = run?.textColor ?? '#111',
                    visible          = Boolean(run),
                    labelled         = visible && end - start >= 6;

                if (state.color !== color || state.end !== end || state.labelled !== labelled ||
                state.splashBackground !== splashBackground || state.splashLogo !== splashLogo ||
                state.start !== start || state.textColor !== textColor || state.visible !== visible) {
                    Object.assign(state, {
                        color,
                        end,
                        labelled,
                        splashBackground,
                        splashLogo,
                        start,
                        textColor,
                        visible
                    });

                    if (updateRecords) {
                        updateRegionRecord(index);
                    }
                }
            }
        }
    });
}

function startSplashAnimation() {
    stopSplashAnimation();
    scheduler.addCls('b-video-splash');
    scheduler.removeCls('b-video-splash-ready');

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        applySplashLogoFrame(splashLogoTop);
        scheduler.addCls('b-video-splash-ready');
        return;
    }

    let
        animationStart,
        lastSplashFrameTime = -Infinity;

    const drawSplashFrame = timestamp => {
        animationStart ??= timestamp;

        const
            elapsed  = timestamp - animationStart,
            progress = Math.min(elapsed / splashAnimationTime, 1),
            eased    = 1 - (1 - progress) ** 3;

        if (timestamp - lastSplashFrameTime >= 1000 / maximumFrameRate - 1 || progress === 1) {
            const logoTop = Math.round(sampleRows + (splashLogoTop - sampleRows) * eased);

            applySplashLogoFrame(logoTop);
            lastSplashFrameTime = timestamp;
        }

        if (progress < 1) {
            splashFrameRequestId = requestAnimationFrame(drawSplashFrame);
        }
        else {
            splashFrameRequestId = null;
            scheduler.addCls('b-video-splash-ready');
        }
    };

    applySplashLogoFrame(sampleRows);
    splashFrameRequestId = requestAnimationFrame(drawSplashFrame);
}

function drawVideoFrame() {
    // An audio-only file loads and "plays" fine, but has nothing to sample, so bail out instead of showing black.
    if (!video.videoWidth) {
        setStatus('Selected file has no video track', true);
        video.pause();
        return false;
    }

    const
        sourceRatio = video.videoWidth / video.videoHeight,
        targetRatio = sampleColumns / sampleRows;

    let
        drawWidth  = sampleColumns,
        drawHeight = sampleRows,
        drawX      = 0,
        drawY      = 0;

    if (sourceRatio > targetRatio) {
        drawHeight = sampleColumns / sourceRatio;
        drawY = (sampleRows - drawHeight) / 2;
    }
    else {
        drawWidth = sampleRows * sourceRatio;
        drawX = (sampleColumns - drawWidth) / 2;
    }

    stopSplashAnimation();
    context.fillStyle = blackFill;
    context.fillRect(0, 0, sampleColumns, sampleRows);
    context.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    applyFrame(context.getImageData(0, 0, sampleColumns, sampleRows).data);
    scheduler.removeCls('b-video-splash');
    scheduler.removeCls('b-video-splash-ready');

    return true;
}

function requestNextFrame() {
    if (video.paused || video.ended) {
        frameRequestId = frameRequestType = null;
        return;
    }

    if (video.requestVideoFrameCallback) {
        frameRequestType = 'video';
        frameRequestId = video.requestVideoFrameCallback(onVideoFrame);
    }
    else {
        frameRequestType = 'animation';
        frameRequestId = requestAnimationFrame(onVideoFrame);
    }
}

function onVideoFrame(timestamp, metadata) {
    const mediaTime = metadata?.mediaTime ?? video.currentTime;

    if (mediaTime < lastFrameTime || mediaTime - lastFrameTime >= 1 / maximumFrameRate - 0.001) {
        drawVideoFrame();
        lastFrameTime = mediaTime;
    }

    requestNextFrame();
}

// lastFrameTime is deliberately left alone here: loadVideo already draws the first frame and records its time, so
// resetting would redraw that same frame. Looping back to the start is caught by the mediaTime < lastFrameTime test.
function startFrameLoop() {
    stopFrameLoop();
    requestNextFrame();
}

function fitVideoRows() {
    const availableHeight = scheduler.bodyContainer?.clientHeight;

    if (availableHeight) {
        const rowHeight = Math.max(10, availableHeight / sampleRows);

        // Assigning the same height still re-renders the rows, which the ResizeObserver then sees as another resize
        if (Math.abs(scheduler.rowHeight - rowHeight) > 0.5) {
            scheduler.rowHeight = rowHeight;
        }
    }
}

function fitSplashLogo() {
    const
        availableWidth  = scheduler.timeAxisSubGridElement?.clientWidth,
        rowHeight       = scheduler.rowHeight,
        columnWidth     = availableWidth / sampleColumns,
        maximumWidth    = (sampleColumns - 8) * columnWidth,
        maximumHeight   = (sampleRows - 8) * rowHeight,
        renderedHeight  = Math.min(maximumHeight, maximumWidth / splashLogoAspectRatio),
        logoColumns     = Math.max(1, Math.round(renderedHeight * splashLogoAspectRatio / columnWidth)),
        logoRows        = Math.max(1, Math.round(renderedHeight / rowHeight));

    if (!availableWidth || !rowHeight ||
        splashLogoBitmap.length === logoRows && splashLogoBitmap[0].length === logoColumns) {
        return false;
    }

    splashLogoBitmap = createSplashLogoBitmap(logoColumns, logoRows);
    splashLogoTop = Math.floor((sampleRows - logoRows) / 2);

    return true;
}

function applyResize() {
    fitVideoRows();

    if (fitSplashLogo() && scheduler.element.classList.contains('b-video-splash-ready')) {
        applySplashLogoFrame(splashLogoTop);
    }
}

// Resizing the rows and the splash logo changes the size of the elements the ResizeObserver is watching. Doing that
// synchronously inside its callback feeds the observer back into itself, which the browser reports as "ResizeObserver
// loop completed with undelivered notifications". Deferring to the next frame breaks the loop and coalesces bursts of
// resizes into a single pass
function onResize() {
    if (resizePending) {
        return;
    }

    resizePending = true;

    requestAnimationFrame(() => {
        resizePending = false;
        applyResize();
    });
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) {
        return 'duration unavailable';
    }

    const
        minutes   = Math.floor(seconds / 60),
        remainder = Math.floor(seconds % 60).toString().padStart(2, '0');

    return `${minutes}:${remainder}`;
}

async function loadVideo(file) {
    const currentLoadId = ++loadId;

    stopFrameLoop();
    stopSplashAnimation();
    video.pause();
    updatePlaybackButton(false);
    scheduler.widgetMap.playPauseButton.disabled = true;
    setStatus(`Loading ${file.name}...`);

    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(file);

    const mediaReady = new Promise((resolve, reject) => {
        const cleanup = () => {
            video.removeEventListener('loadeddata', onLoadedData);
            video.removeEventListener('error', onError);
        };
        const onLoadedData = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject();
        };

        video.addEventListener('loadeddata', onLoadedData);
        video.addEventListener('error', onError);
    });

    video.src = objectUrl;
    video.load();

    try {
        await mediaReady;
    }
    catch {
        if (currentLoadId === loadId) {
            startSplashAnimation();
            setStatus('This browser cannot play the selected video', true);
        }
        return;
    }

    if (currentLoadId !== loadId) {
        return;
    }

    if (!drawVideoFrame()) {
        startSplashAnimation();
        return;
    }

    lastFrameTime = video.currentTime;
    scheduler.widgetMap.playPauseButton.disabled = false;
    setStatus(`${file.name} · ${formatDuration(video.duration)}`);

    try {
        await video.play();
    }
    catch {
        updatePlaybackButton(false);
    }
}

applySplashLogoFrame(sampleRows, false);
events.forEach((event, index) => Object.assign(event, getRegionRecordData(regionStates[index])));

// Scheduler measures its container when it is created. Some hosts, such as the CodePen preview, run the page in an
// iframe that has no layout size until after it has loaded, which makes those measurements zero and leaves Scheduler
// unable to render its rows when the size does arrive
async function bodyHasSize() {
    if (document.body.clientWidth && document.body.clientHeight) {
        return;
    }

    await new Promise(resolve => {
        // A browser that drops resize notifications, which it reports as "ResizeObserver loop completed with
        // undelivered notifications", would otherwise leave this waiting forever and the app would never be created
        const timerId = setTimeout(finish, 1000);

        function finish() {
            clearTimeout(timerId);
            observer.disconnect();
            resolve();
        }

        const observer = new ResizeObserver(() => {
            if (document.body.clientWidth && document.body.clientHeight) {
                finish();
            }
        });

        observer.observe(document.body);
    });
}

await bodyHasSize();

const scheduler = new Scheduler({
    appendTo   : document.body,
    cls        : 'b-video-pixels b-video-paused b-video-splash b-video-labels-hidden',
    resources,
    eventStore : {
        modelClass : VideoEventModel,
        data       : events
    },
    startDate : displayStartDate,
    endDate   : displayEndDate,
    columns   : [
        {
            text   : 'Resource',
            field  : 'name',
            width  : 140,
            editor : false
        }
    ],
    rowHeight                 : 10,
    barMargin                 : 0,
    forceFit                  : true,
    fillTicks                 : true,
    eventColor                : null,
    eventStyle                : null,
    rowLines                  : false,
    useInitialAnimation       : false,
    zoomOnMouseWheel          : false,
    zoomOnTimeAxisDoubleClick : false,
    enableRecurringEvents     : false,
    createEventOnDblClick     : false,
    maintainVisibleStartDate  : false,
    eventLayout               : 'none',
    // Event-change transitions make Bryntum track running CSS animations across the whole
    // component subtree on every refresh, which dominates the frame cost at 30 updates a second
    transition                : {
        changeEvent : false
    },
    viewPreset                : {
        base           : 'dayAndWeek',
        tickWidth      : 10,
        timeResolution : {
            unit      : 'day',
            increment : 1
        },
        headers : [
            { unit : 'month', dateFormat : 'MMMM YYYY' },
            { unit : 'day', dateFormat : 'D' }
        ]
    },
    features : {
        columnLines     : false,
        eventCopyPaste  : false,
        eventDrag       : false,
        eventDragCreate : false,
        // The events are a recycled rendering pool: any edit is overwritten by the next frame
        eventEdit       : false,
        eventMenu       : false,
        eventResize     : false,
        eventTooltip    : {
            cls : 'b-video-event-tooltip',
            template({ eventRecord }) {
                const index = eventRecord.id - 1;

                return StringHelper.xss`<div class="b-video-tooltip-content">
                    <strong>${eventRecord.name}</strong>
                    <span>${meetingRooms[index % meetingRooms.length]} · ${eventRecord.resource.name}</span>
                </div>`;
            }
        },
        regionResize    : true,
        scheduleMenu    : false,
        scheduleTooltip : false,
        stickyEvents    : false
    },
    eventRenderer({ eventRecord, renderData }) {
        renderData.cls['b-video-region'] = 1;
        renderData.cls['b-video-region-hidden'] = !eventRecord.videoVisible;
        renderData.cls['b-video-region-labelled'] = eventRecord.videoLabelled;
        renderData.cls['b-video-splash-background'] = eventRecord.videoSplashBackground;
        renderData.cls['b-video-splash-logo'] = eventRecord.videoSplashLogo;
        renderData.wrapperCls['b-video-splash-background-wrap'] = eventRecord.videoSplashBackground;
        renderData.wrapperCls['b-video-splash-logo-wrap'] = eventRecord.videoSplashLogo;
        renderData.style = `background-color:${eventRecord.videoColor};color:${eventRecord.videoTextColor};` +
            `inset-inline-start:${eventRecord.videoStart / sampleColumns * 100}%;` +
            `inline-size:${(eventRecord.videoEnd - eventRecord.videoStart) / sampleColumns * 100}%`;

        return StringHelper.encodeHtml(eventRecord.name);
    },
    listeners : {
        subGridCollapse({ subGrid }) {
            if (subGrid.region === 'locked') {
                scheduler.widgetMap.resourcesCheckbox.checked = false;
            }
        },
        subGridExpand({ subGrid }) {
            if (subGrid.region === 'locked') {
                scheduler.widgetMap.resourcesCheckbox.checked = true;
            }
        }
    },
    tbar : [
        {
            type            : 'filepicker',
            ref             : 'videoPicker',
            cls             : 'b-video-picker',
            showBadge       : false,
            fileFieldConfig : {
                accept    : 'video/*',
                ariaLabel : 'Choose a local video'
            },
            buttonConfig : {
                text  : 'Choose video',
                icon  : 'fa fa-film',
                color : 'b-blue'
            },
            onChange({ files, source }) {
                const file = files[0];

                source.clear();

                if (file) {
                    loadVideo(file);
                }
            }
        },
        {
            type     : 'button',
            ref      : 'playPauseButton',
            icon     : 'fa fa-play',
            tooltip  : 'Play video',
            disabled : true,
            onAction() {
                if (video.paused) {
                    video.play();
                }
                else {
                    video.pause();
                }
            }
        },
        {
            type    : 'checkbox',
            ref     : 'resourcesCheckbox',
            text    : 'Resources',
            checked : true,
            tooltip : 'Show resource column',
            onChange({ checked }) {
                scheduler.getSubGrid('locked')[checked ? 'expand' : 'collapse']();
            }
        },
        {
            type    : 'checkbox',
            ref     : 'labelsCheckbox',
            text    : 'Labels',
            checked : false,
            tooltip : 'Show event labels',
            onChange({ checked }) {
                scheduler[checked ? 'removeCls' : 'addCls']('b-video-labels-hidden');
            }
        },
        {
            type : 'label',
            role : 'status',
            ref  : 'sourceLabel',
            cls  : 'b-video-source-label',
            text : ''
        },
        '->',
        {
            type    : 'button',
            ref     : 'bunnyDownloadButton',
            cls     : 'b-video-download',
            text    : 'Bunny video',
            icon    : 'fa fa-external-link-alt',
            tooltip : 'Open Big Buck Bunny sample video in a new tab',
            href    : 'https://www.w3schools.com/html/mov_bbb.mp4',
            target  : '_blank'
        },
        {
            type    : 'button',
            ref     : 'rickrollDownloadButton',
            cls     : 'b-video-download',
            text    : 'Rickroll',
            icon    : 'fa fa-external-link-alt',
            tooltip : 'Open Rick Astley sample video in a new tab',
            href    : 'https://media.tenor.com/DFwPhj-PBzYAAAPo/rick-astley-rickrolling.mp4',
            target  : '_blank'
        }
    ]
});

// Exposed for testing framerate
window.scheduler = scheduler;

video.addEventListener('play', () => {
    updatePlaybackButton(true);
    scheduler.features.eventTooltip.disabled = true;
    scheduler.removeCls('b-video-paused');
    startFrameLoop();
});

video.addEventListener('pause', () => {
    updatePlaybackButton(false);
    scheduler.features.eventTooltip.disabled = false;
    scheduler.addCls('b-video-paused');
    stopFrameLoop();
});

window.addEventListener('beforeunload', () => {
    stopFrameLoop();
    stopSplashAnimation();
    resizeObserver?.disconnect();

    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }
});

requestAnimationFrame(() => {
    applyResize();
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(scheduler.bodyContainer);
    resizeObserver.observe(scheduler.timeAxisSubGridElement);
    startSplashAnimation();
});
