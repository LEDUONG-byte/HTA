/**
 * SPC DASHBOARD - CONTROLLER JAVASCRIPT
 * Thiết kế hệ thống đồng bộ theo chuẩn Axon AI Workflow Automation (Wolfpixel)
 * Trực quan hóa dữ liệu cao cấp, tỷ lệ kích thước cân đối và tương tác mượt mà
 */

function initSpcDashboard() {
  // Bộ nhớ đệm các instance biểu đồ và chữ ký dữ liệu
  const chartInstances = {};
  const chartSignatures = {};

  let currentView = "overview"; // 'overview' | 'defect' | 'log' | 'settings'
  let currentDefectId = null;
  let spcData = null;
  let prevKpiSnapshot = null;
  let lastDataTime = Date.now();
  let currentOverviewTab = "corr"; // 'corr' | 'status' | 'share'

  // Khởi tạo các sự kiện giao diện và kết nối máy chủ
  initNavigation();
  initOverviewChartTabs();
  initDefectTabs();
  initSimulator();
  initTimeUpdater();
  initSearchAndFilters();

  // Nạp dữ liệu ban đầu ngay lập tức để render tức thì mọi biểu đồ và thẻ KPI
  if (typeof window !== "undefined" && window.__INITIAL_SPC_DATA__) {
    handleDataReceived(window.__INITIAL_SPC_DATA__);
  }

  fetchSpcMatrixData();
  connectWebSocket();

  /* ==========================================================================
     1. ĐIỀU HƯỚNG GIAO DIỆN (SIDEBAR & VIEWS)
     ========================================================================== */
  function initNavigation() {
    const btnOverview = document.getElementById("nav-btn-overview");
    const btnSpc = document.getElementById("nav-btn-spc");
    const btnLog = document.getElementById("nav-btn-log");
    const btnSettings = document.getElementById("nav-btn-settings");
    const submenu = document.getElementById("spc-submenu-list");
    const chevron = document.getElementById("spc-nav-chevron");
    const breadcrumbRoot = document.getElementById("breadcrumb-root");

    if (btnOverview) {
      btnOverview.addEventListener("click", () => activateView("overview"));
    }

    if (breadcrumbRoot) {
      breadcrumbRoot.addEventListener("click", () => activateView("overview"));
    }

    if (btnSpc) {
      btnSpc.addEventListener("click", () => {
        if (currentView !== "defect") {
          submenu?.classList.add("open");
          chevron?.classList.add("rotated");
          const targetDefectId = currentDefectId || spcData?.defects?.[0]?.id || "defect_1";
          activateDefectView(targetDefectId);
        } else {
          const isOpen = submenu?.classList.toggle("open");
          chevron?.classList.toggle("rotated", isOpen);
        }
      });
    }

    if (btnLog) {
      btnLog.addEventListener("click", () => activateView("log"));
    }

    if (btnSettings) {
      btnSettings.addEventListener("click", () => activateView("settings"));
    }

    const filterSelect = document.getElementById("overview-time-filter");
    if (filterSelect) {
      filterSelect.addEventListener("change", () => {
        if (spcData) renderOverviewCharts(spcData);
      });
    }
  }

  function initOverviewChartTabs() {
    const tabCorr = document.getElementById("tab-chart-corr");
    const tabStatus = document.getElementById("tab-chart-status");
    const tabShare = document.getElementById("tab-chart-share");

    const canvasCorr = document.getElementById("chart-correlation-overview");
    const donutWrapper = document.getElementById("donut-view-wrapper");
    const canvasStatus = document.getElementById("chart-overview-status");
    const canvasShare = document.getElementById("chart-overview-defect-share");

    function switchOverviewTab(tabKey) {
      currentOverviewTab = tabKey;
      [tabCorr, tabStatus, tabShare].forEach(b => b?.classList.remove("active"));

      if (tabKey === "corr") {
        tabCorr?.classList.add("active");
        if (canvasCorr) canvasCorr.style.display = "block";
        if (donutWrapper) donutWrapper.style.display = "none";
        if (spcData) renderCorrelationBarChart(spcData.defects || [], true);
      } else if (tabKey === "status") {
        tabStatus?.classList.add("active");
        if (canvasCorr) canvasCorr.style.display = "none";
        if (donutWrapper) donutWrapper.style.display = "flex";
        if (canvasStatus) canvasStatus.style.display = "block";
        if (canvasShare) canvasShare.style.display = "none";
        if (spcData) {
          renderStatusDonutChart(spcData.summary || {}, true);
          renderStatusBreakdown(spcData.summary || {});
        }
      } else if (tabKey === "share") {
        tabShare?.classList.add("active");
        if (canvasCorr) canvasCorr.style.display = "none";
        if (donutWrapper) donutWrapper.style.display = "flex";
        if (canvasStatus) canvasStatus.style.display = "none";
        if (canvasShare) canvasShare.style.display = "block";
        if (spcData) {
          renderDefectShareChart(spcData.defects || [], true);
          renderDefectShareBreakdown(spcData.defects || []);
        }
      }
    }

    tabCorr?.addEventListener("click", () => switchOverviewTab("corr"));
    tabStatus?.addEventListener("click", () => switchOverviewTab("status"));
    tabShare?.addEventListener("click", () => switchOverviewTab("share"));
  }

  function initDefectTabs() {
    const tabCharts = document.getElementById("tab-defect-charts");
    const tabBatches = document.getElementById("tab-defect-batches");
    const tabViolations = document.getElementById("tab-defect-violations");

    const paneCharts = document.getElementById("pane-defect-charts");
    const paneBatches = document.getElementById("pane-defect-batches");
    const paneViolations = document.getElementById("pane-defect-violations");

    const batchCount = document.getElementById("single-batch-count");
    const violCount = document.getElementById("single-violation-count");

    function switchDefectTab(tabKey) {
      [tabCharts, tabBatches, tabViolations].forEach(btn => btn?.classList.remove("active"));
      [paneCharts, paneBatches, paneViolations].forEach(pane => pane?.classList.remove("active"));

      if (tabKey === "charts") {
        tabCharts?.classList.add("active");
        paneCharts?.classList.add("active");
        if (batchCount) batchCount.style.display = "none";
        if (violCount) violCount.style.display = "none";
        resizeAllCharts();
      } else if (tabKey === "batches") {
        tabBatches?.classList.add("active");
        paneBatches?.classList.add("active");
        if (batchCount) batchCount.style.display = "inline-flex";
        if (violCount) violCount.style.display = "none";
      } else if (tabKey === "violations") {
        tabViolations?.classList.add("active");
        paneViolations?.classList.add("active");
        if (batchCount) batchCount.style.display = "none";
        if (violCount) violCount.style.display = "inline-flex";
      }
    }

    tabCharts?.addEventListener("click", () => switchDefectTab("charts"));
    tabBatches?.addEventListener("click", () => switchDefectTab("batches"));
    tabViolations?.addEventListener("click", () => switchDefectTab("violations"));
  }

  function activateView(viewName) {
    currentView = viewName;

    document.querySelectorAll(".nav-item-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".submenu-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view-panel").forEach(panel => panel.classList.remove("active"));

    const breadcrumbActive = document.getElementById("breadcrumb-active");

    if (viewName === "overview") {
      document.getElementById("nav-btn-overview")?.classList.add("active");
      document.getElementById("view-panel-overview")?.classList.add("active");
      if (breadcrumbActive) breadcrumbActive.textContent = "Tổng quan";
      resizeAllCharts();
    } else if (viewName === "log") {
      document.getElementById("nav-btn-log")?.classList.add("active");
      document.getElementById("view-panel-log")?.classList.add("active");
      if (breadcrumbActive) breadcrumbActive.textContent = "Nhật ký";
    } else if (viewName === "settings") {
      document.getElementById("nav-btn-settings")?.classList.add("active");
      document.getElementById("view-panel-settings")?.classList.add("active");
      if (breadcrumbActive) breadcrumbActive.textContent = "Cài đặt";
    }
  }

  function activateDefectView(defectId) {
    currentView = "defect";
    currentDefectId = defectId;

    document.querySelectorAll(".nav-item-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("nav-btn-spc")?.classList.add("active");

    const submenu = document.getElementById("spc-submenu-list");
    const chevron = document.getElementById("spc-nav-chevron");
    if (submenu && !submenu.classList.contains("open")) {
      submenu.classList.add("open");
      chevron?.classList.add("rotated");
    }

    document.querySelectorAll(".submenu-item").forEach(item => {
      item.classList.toggle("active", item.dataset.defectId === defectId);
    });

    // Mở View Panel trước khi render biểu đồ để canvas có kích thước thực
    document.querySelectorAll(".view-panel").forEach(panel => panel.classList.remove("active"));
    const defectPanel = document.getElementById("view-panel-defect");
    if (defectPanel) defectPanel.classList.add("active");

    const defect = spcData?.defects?.find(d => d.id === defectId) || spcData?.defects?.[0];
    const breadcrumbActive = document.getElementById("breadcrumb-active");
    if (breadcrumbActive && defect) {
      const code = defect.id.replace("defect_", "E");
      breadcrumbActive.textContent = `SPC từng lỗi > ${code} - ${defect.errorName}`;
    }

    if (defect) {
      renderSingleDefectDetail(defect);
    }
  }

  // Khởi tạo tìm kiếm và bộ lọc cho trang Nhật ký
  function initSearchAndFilters() {
    const logSearch = document.getElementById("log-search-input");
    const logSeverity = document.getElementById("log-severity-filter");
    if (logSearch || logSeverity) {
      const handleLogFilter = () => {
        if (!spcData) return;
        const q = (logSearch?.value || "").toLowerCase();
        const sev = logSeverity?.value || "all";
        let filtered = spcData.alertHistory || [];

        if (sev !== "all") {
          filtered = filtered.filter(a => a.severity === sev);
        }
        if (q) {
          filtered = filtered.filter(a =>
            (a.errorName && a.errorName.toLowerCase().includes(q)) ||
            (a.batchId && a.batchId.toLowerCase().includes(q)) ||
            (a.message && a.message.toLowerCase().includes(q))
          );
        }
        renderLogTable(filtered, spcData.defects);
      };

      logSearch?.addEventListener("input", handleLogFilter);
      logSeverity?.addEventListener("change", handleLogFilter);
    }
  }

  /* ==========================================================================
     2. ĐỒNG BỘ DỮ LIỆU TỪ MÁY CHỦ (REST & WEBSOCKET)
     ========================================================================== */
  async function fetchSpcMatrixData() {
    if (window.location.protocol === "file:") return;
    try {
      const response = await fetch("/api/spc");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      handleDataReceived(data);
    } catch (error) {
      console.warn("Lỗi khi tải dữ liệu SPC từ API:", error);
    }
  }

  function connectWebSocket() {
    if (window.location.protocol === "file:") return;
    const host = window.location.host;
    if (!host) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws = null;
    try {
      ws = new WebSocket(`${protocol}//${host}/ws/dashboard`);
    } catch (e) {
      console.warn("Không thể mở WebSocket:", e);
      return;
    }

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        handleDataReceived(data);
      } catch (error) {
        console.error("Lỗi giải mã WebSocket JSON:", error);
      }
    };

    ws.onclose = () => {
      window.setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = error => {
      console.warn("WebSocket gặp lỗi:", error);
      try { ws.close(); } catch (_) {}
    };
  }

  function handleDataReceived(data) {
    if (!data || !Array.isArray(data.defects)) return;
    spcData = data;
    lastDataTime = Date.now();
    updateLastUpdatedText();

    // 1. Cập nhật Sidebar Submenu
    renderSidebarSubmenu(data.defects);

    // 2. Cập nhật dữ liệu Tổng quan
    renderOverviewKpis(data);
    renderOverviewCharts(data);
    renderOccAlerts(data);
    renderDefectSummaryGrid(data.defects);

    // 3. Nếu đang ở màn hình Chi tiết lỗi
    if (currentView === "defect" && currentDefectId) {
      const currentDefect = data.defects.find(d => d.id === currentDefectId) || data.defects[0];
      if (currentDefect) renderSingleDefectDetail(currentDefect);
    }

    // 4. Cập nhật Nhật ký và Cài đặt
    renderLogTable(data.alertHistory || [], data.defects);
    renderSpecsTable(data.defects);
  }

  /* ==========================================================================
     3. SIDEBAR SUBMENU CÁC LOẠI LỖI (E1 - E8)
     ========================================================================== */
  function renderSidebarSubmenu(defects) {
    const submenu = document.getElementById("spc-submenu-list");
    if (!submenu) return;

    if (submenu.children.length === 0) {
      submenu.innerHTML = "";
      defects.forEach(defect => {
        const code = defect.id.replace("defect_", "E");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "submenu-item";
        btn.dataset.defectId = defect.id;
        btn.title = defect.errorName;

        let dotClass = "good";
        if (defect.status === "DANGER") dotClass = "danger";
        else if (defect.status === "WARNING") dotClass = "warning";

        btn.innerHTML = `
          <span>${code} - ${escapeHtml(defect.errorName)}</span>
          <span class="submenu-dot ${dotClass}"></span>
        `;
        btn.addEventListener("click", () => activateDefectView(defect.id));
        submenu.appendChild(btn);
      });
    } else {
      // Cập nhật trạng thái đèn báo động cho từng lỗi
      defects.forEach(defect => {
        const btn = submenu.querySelector(`[data-defect-id="${defect.id}"]`);
        if (btn) {
          const dot = btn.querySelector(".submenu-dot");
          if (dot) {
            let dotClass = "good";
            if (defect.status === "DANGER") dotClass = "danger";
            else if (defect.status === "WARNING") dotClass = "warning";
            dot.className = `submenu-dot ${dotClass}`;
          }
        }
      });
    }

    document.querySelectorAll(".submenu-item").forEach(item => {
      item.classList.toggle("active", currentView === "defect" && item.dataset.defectId === currentDefectId);
    });
  }

  /* ==========================================================================
     4. RENDER VIEW 1: TỔNG QUAN (OVERVIEW)
     ========================================================================== */
  function updateTrendBadge(elementId, delta, unit = "%") {
    const el = document.getElementById(elementId);
    if (!el) return;

    const threshold = 0.05;
    if (delta < -threshold) {
      // GIẢM LỖI -> TỐT -> XANH LÁ
      el.textContent = `↘ -${Math.abs(delta).toFixed(1)}${unit}`;
      el.className = "kpi-trend trend-good";
    } else if (delta > threshold) {
      // TĂNG LỖI -> XẤU / NGUY HIỂM -> ĐỎ
      el.textContent = `↗ +${delta.toFixed(1)}${unit}`;
      el.className = "kpi-trend trend-danger";
    } else {
      // KHÔNG ĐỔI -> XÁM TRUNG TÍNH
      el.textContent = `→ 0.0${unit}`;
      el.className = "kpi-trend trend-neutral";
    }
  }

  function renderOverviewKpis(data) {
    const defects = data.defects || [];
    const totalDefects = defects.length;

    // 1. Trạng thái hệ thống
    const hasDanger = defects.some(d => d.status === "DANGER");
    const hasWarning = defects.some(d => d.status === "WARNING");
    const sysStatusEl = document.getElementById("kpi-sys-status");
    if (sysStatusEl) {
      if (hasDanger) {
        sysStatusEl.textContent = "NGUY HIỂM";
        sysStatusEl.className = "kpi-value status-danger";
      } else if (hasWarning) {
        sysStatusEl.textContent = "CẦN CHÚ Ý";
        sysStatusEl.className = "kpi-value status-warning";
      } else {
        sysStatusEl.textContent = "TỐT";
        sysStatusEl.className = "kpi-value status-good";
      }
    }

    // 2. Tổng lỗi kích hoạt (Công đoạn cảnh báo hoặc nguy hiểm)
    const alertDefects = defects.filter(d => d.status === "DANGER" || d.status === "WARNING");
    const activePercent = totalDefects > 0 ? Math.round((alertDefects.length / totalDefects) * 100) : 0;
    setText("kpi-active-defects", `${activePercent}%`);

    // 3. Tỷ lệ khuyết tật OOS
    const totalSamples = defects.reduce((sum, d) => sum + (d.totalCount || 0), 0);
    const totalOos = defects.reduce((sum, d) => sum + (d.oosCount || 0), 0);
    const currentDefectRate = totalSamples > 0 ? (totalOos / totalSamples) * 100 : 0;
    setText("kpi-defect-rate", `${currentDefectRate.toFixed(1)}%`);

    // Tính toán xu hướng biến thiên động (Dynamic Trend)
    let deltaRate = 0;
    let deltaActive = 0;

    if (prevKpiSnapshot) {
      // So sánh trực tiếp với phiên bản dữ liệu trước đó
      deltaRate = currentDefectRate - prevKpiSnapshot.defectRate;
      deltaActive = activePercent - prevKpiSnapshot.activePercent;
    } else {
      // Khởi tạo lần đầu: So sánh các lô mới nhất vs các lô trước trong lịch sử
      let recentOos = 0, recentSamples = 0;
      let priorOos = 0, priorSamples = 0;
      let recentAlerts = 0, priorAlerts = 0;

      defects.forEach(d => {
        const history = d.batchHistory || [];
        if (history.length > 0) {
          const latest = history[0];
          recentOos += (latest.oosCount || 0);
          recentSamples += (latest.sampleCount || 0);
          if ((latest.oosCount || 0) > 0 || (latest.violations && latest.violations.length > 0)) {
            recentAlerts++;
          }

          const samplePrior = history.slice(1, 6);
          samplePrior.forEach(b => {
            priorOos += (b.oosCount || 0);
            priorSamples += (b.sampleCount || 0);
            if ((b.oosCount || 0) > 0 || (b.violations && b.violations.length > 0)) {
              priorAlerts++;
            }
          });
        }
      });

      const recentRate = recentSamples > 0 ? (recentOos / recentSamples) * 100 : currentDefectRate;
      const priorRate = priorSamples > 0 ? (priorOos / priorSamples) * 100 : currentDefectRate;
      deltaRate = recentRate - priorRate;

      const recentAlertPercent = totalDefects > 0 ? (recentAlerts / totalDefects) * 100 : activePercent;
      const priorAlertPercent = (totalDefects > 0 && priorSamples > 0) ? (priorAlerts / 5 / totalDefects) * 100 : activePercent;
      deltaActive = recentAlertPercent - priorAlertPercent;
    }

    // Cập nhật huy hiệu xu hướng động (GIẢM LỖI = XANH, TĂNG LỖI = ĐỎ)
    updateTrendBadge("kpi-rate-trend", deltaRate, "%");
    updateTrendBadge("kpi-active-trend", deltaActive, "%");

    prevKpiSnapshot = {
      defectRate: currentDefectRate,
      activePercent: activePercent
    };

    // 4. Lỗi phổ biến nhất
    const sortedByIssues = [...defects].sort((a, b) => (b.oosCount + b.spcViolationsCount) - (a.oosCount + a.spcViolationsCount));
    const problemDefects = sortedByIssues.filter(d => (d.oosCount + d.spcViolationsCount) > 0);
    let commonText = "Không có";
    if (problemDefects.length > 0) {
      commonText = problemDefects.slice(0, 2).map(d => d.id.replace("defect_", "E")).join(", ");
    }
    setText("kpi-common-defects", commonText);
  }

  /* ==========================================================================
     5. TRỰC QUAN HÓA BIỂU ĐỒ CAO CẤP (AXON SAAS DATA VISUALIZATION)
     ========================================================================== */

  function patchChartRoundedBars() {
    if (typeof Chart === "undefined" || !Chart.elements || !Chart.elements.Rectangle) return;
    if (Chart.elements.Rectangle.prototype._hasRoundedPatch) return;

    const origDraw = Chart.elements.Rectangle.prototype.draw;
    Chart.elements.Rectangle.prototype.draw = function() {
      const vm = this._view;
      if (!vm || vm.horizontal) return origDraw.call(this);

      const ctx = this._chart.ctx;
      const left = vm.x - vm.width / 2;
      const right = vm.x + vm.width / 2;
      const top = vm.y;
      const bottom = vm.base;
      const radius = Math.min(4, Math.abs(right - left) / 2, Math.abs(bottom - top));

      ctx.beginPath();
      ctx.fillStyle = vm.backgroundColor;
      ctx.strokeStyle = vm.borderColor;
      ctx.lineWidth = vm.borderWidth || 0;

      if (top < bottom) {
        ctx.moveTo(left, bottom);
        ctx.lineTo(left, top + radius);
        ctx.quadraticCurveTo(left, top, left + radius, top);
        ctx.lineTo(right - radius, top);
        ctx.quadraticCurveTo(right, top, right, top + radius);
        ctx.lineTo(right, bottom);
      } else {
        ctx.moveTo(left, bottom);
        ctx.lineTo(left, top - radius);
        ctx.quadraticCurveTo(left, top, left + radius, top);
        ctx.lineTo(right - radius, top);
        ctx.quadraticCurveTo(right, top, right, top - radius);
        ctx.lineTo(right, bottom);
      }
      ctx.closePath();
      ctx.fill();
      if (vm.borderWidth) {
        ctx.stroke();
      }
    };
    Chart.elements.Rectangle.prototype._hasRoundedPatch = true;
  }

  function createAreaGradient(ctx, height, hexColor, topAlpha = 0.28, bottomAlpha = 0.0) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height || 250);
    const rgb = hexToRgb(hexColor);
    gradient.addColorStop(0, `rgba(${rgb}, ${topAlpha})`);
    gradient.addColorStop(0.65, `rgba(${rgb}, ${topAlpha * 0.25})`);
    gradient.addColorStop(1, `rgba(${rgb}, ${bottomAlpha})`);
    return gradient;
  }

  function hexToRgb(hex) {
    let c = String(hex || "#f14b24").replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const n = parseInt(c, 16) || 0;
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function renderOverviewCharts(data) {
    const defects = data.defects || [];
    const summary = data.summary || {};

    if (currentOverviewTab === "corr") {
      renderCorrelationBarChart(defects);
    } else if (currentOverviewTab === "status") {
      renderStatusDonutChart(summary);
      renderStatusBreakdown(summary);
    } else if (currentOverviewTab === "share") {
      renderDefectShareChart(defects);
      renderDefectShareBreakdown(defects);
    }
  }

  function renderCorrelationBarChart(defects, forceRecreate = false) {
    const canvas = document.getElementById("chart-correlation-overview");
    if (!canvas || typeof Chart === "undefined") return;

    const labels = defects.map(d => `${d.id.replace("defect_", "E")}`);
    const cpkValues = defects.map(d => d.cpk ?? 0);
    const oosRates = defects.map(d => {
      const tot = d.totalCount || 0;
      return tot > 0 ? Number(((d.oosCount / tot) * 100).toFixed(1)) : 0;
    });

    const signature = JSON.stringify({ cpkValues, oosRates });
    if (!forceRecreate && chartSignatures["overview-corr"] === signature && chartInstances["overview-corr"]) return;

    if (chartInstances["overview-corr"]) {
      chartInstances["overview-corr"].destroy();
    }

    const ctx = canvas.getContext("2d");

    // Mốc chuẩn Target Benchmark line Cpk = 1.33
    const targetCpkLine = Array(labels.length).fill(1.33);

    // Plugin đường crosshair gióng dọc khi rê chuột chuẩn Axon UI
    const axonCrosshairPlugin = {
      afterDraw: function(chart) {
        if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
          const activePoint = chart.tooltip._active[0];
          const c = chart.ctx;
          const x = activePoint.tooltipPosition().x;
          const topY = chart.chartArea.top;
          const bottomY = chart.chartArea.bottom;

          c.save();
          c.beginPath();
          c.setLineDash([4, 4]);
          c.moveTo(x, topY);
          c.lineTo(x, bottomY);
          c.lineWidth = 1.2;
          c.strokeStyle = "#94a3b8";
          c.stroke();
          c.restore();
        }
      }
    };

    chartInstances["overview-corr"] = new Chart(ctx, {
      type: "line",
      plugins: [axonCrosshairPlugin],
      data: {
        labels: labels,
        datasets: [
          {
            label: "Chỉ số Cpk (Năng lực)",
            data: cpkValues,
            borderColor: "#b91c1c", // Đỏ mận đậm chuẩn Axon
            backgroundColor: "transparent",
            borderWidth: 2.2,
            lineTension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: "#ffffff",
            pointHoverBorderColor: "#b91c1c",
            pointHoverBorderWidth: 2.5,
            fill: false,
            yAxisID: "y-cpk"
          },
          {
            label: "Tỷ lệ OOS (%)",
            data: oosRates,
            borderColor: "#fb923c", // Cam mơ ấm chuẩn Axon
            backgroundColor: "transparent",
            borderWidth: 2,
            lineTension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: "#ffffff",
            pointHoverBorderColor: "#fb923c",
            pointHoverBorderWidth: 2.5,
            fill: false,
            yAxisID: "y-oos"
          },
          {
            label: "Chuẩn Cpk (1.33)",
            data: targetCpkLine,
            borderColor: "#cbd5e1",
            borderWidth: 1.2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            yAxisID: "y-cpk"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        hover: {
          mode: "index",
          intersect: false,
          onHover: (e, el) => {
            canvas.style.cursor = el && el.length ? "pointer" : "default";
          }
        },
        legend: {
          display: true,
          position: "top",
          labels: {
            fontColor: "#64748b",
            fontSize: 11.5,
            boxWidth: 8,
            usePointStyle: true,
            padding: 14,
            fontStyle: "600"
          }
        },
        tooltips: {
          mode: "index",
          intersect: false,
          backgroundColor: "#ffffff",
          titleFontColor: "#0f172a",
          titleFontSize: 12,
          titleFontStyle: "bold",
          bodyFontColor: "#334155",
          bodyFontSize: 11.5,
          borderColor: "#e2e8f0",
          borderWidth: 1,
          cornerRadius: 6,
          xPadding: 12,
          yPadding: 10,
          displayColors: true,
          callbacks: {
            title: items => {
              const idx = items[0]?.index ?? 0;
              const d = defects[idx];
              return d ? `${d.id.replace("defect_", "E")} - ${d.errorName}` : "";
            },
            label: item => {
              if (item.datasetIndex === 0) {
                const cpk = item.yLabel;
                let evalText = "Ổn định cao";
                if (cpk < 1.0) evalText = "Không đạt";
                else if (cpk < 1.33) evalText = "Cần theo dõi";
                return ` Chỉ số Cpk: ${cpk} (${evalText})`;
              }
              if (item.datasetIndex === 1) return ` Tỷ lệ OOS: ${item.yLabel}%`;
              if (item.datasetIndex === 2) return ` Chuẩn mục tiêu: 1.33`;
              return "";
            }
          }
        },
        scales: {
          xAxes: [{
            gridLines: { display: false, drawBorder: false },
            ticks: { fontColor: "#64748b", fontStyle: "600", fontSize: 11.5, padding: 8 }
          }],
          yAxes: [
            {
              id: "y-cpk",
              type: "linear",
              position: "left",
              ticks: { beginAtZero: true, fontColor: "#94a3b8", suggestedMax: 2.4, padding: 8, fontSize: 11, stepSize: 0.5 },
              scaleLabel: { display: true, labelString: "Chỉ số Cpk", fontColor: "#64748b", fontStyle: "600", fontSize: 11 },
              gridLines: { color: "#f1f5f9", borderDash: [4, 4], drawBorder: false, zeroLineColor: "#e2e8f0" }
            },
            {
              id: "y-oos",
              type: "linear",
              position: "right",
              ticks: { beginAtZero: true, fontColor: "#fb923c", callback: v => `${v}%`, padding: 8, suggestedMax: 18, fontSize: 11, stepSize: 4 },
              scaleLabel: { display: true, labelString: "Tỷ lệ OOS (%)", fontColor: "#fb923c", fontStyle: "600", fontSize: 11 },
              gridLines: { drawOnChartArea: false, drawBorder: false }
            }
          ]
        }
      }
    });

    canvas.onclick = function(evt) {
      if (!chartInstances["overview-corr"]) return;
      const activePoints = chartInstances["overview-corr"].getElementsAtEvent(evt);
      if (activePoints && activePoints.length > 0) {
        const idx = activePoints[0]._index;
        const targetDefect = defects[idx];
        if (targetDefect) {
          activateDefectView(targetDefect.id);
        }
      }
    };

    chartSignatures["overview-corr"] = signature;
  }

  function renderStatusDonutChart(summary, forceRecreate = false) {
    const canvas = document.getElementById("chart-overview-status");
    if (!canvas || typeof Chart === "undefined") return;

    const data = [
      summary.successCount || 0,
      summary.warningCount || 0,
      summary.dangerCount || 0,
      summary.noDataCount || 0
    ];

    const signature = JSON.stringify(data);
    if (!forceRecreate && chartSignatures["overview-status"] === signature && chartInstances["overview-status"]) return;

    if (chartInstances["overview-status"]) {
      chartInstances["overview-status"].destroy();
    }

    // Cập nhật chỉ số trung tâm overlay kiểu Axon
    const overlayVal = document.getElementById("chart-center-val");
    const overlayLbl = document.getElementById("chart-center-lbl");
    const totalCount = 8;
    const passPercent = Math.round(((summary.successCount || 0) / totalCount) * 100);
    if (overlayVal) overlayVal.textContent = `${passPercent}%`;
    if (overlayLbl) overlayLbl.textContent = "Quy trình đạt chuẩn";

    const ctx = canvas.getContext("2d");
    chartInstances["overview-status"] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Ổn định (Cpk ≥ 1.33)", "Cần theo dõi (1.0 ≤ Cpk < 1.33)", "Nguy hiểm (Cpk < 1.0)", "Chưa có dữ liệu"],
        datasets: [{
          data: data,
          backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"],
          borderWidth: 3,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutoutPercentage: 76,
        legend: { display: false },
        tooltips: {
          backgroundColor: "#0f172a",
          titleFontSize: 12,
          bodyFontSize: 11.5,
          cornerRadius: 4,
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          xPadding: 10,
          yPadding: 8
        }
      }
    });

    chartSignatures["overview-status"] = signature;
  }

  function renderStatusBreakdown(summary) {
    const box = document.getElementById("donut-breakdown-box");
    if (!box) return;
    const items = [
      { label: "Ổn định (Cpk ≥ 1.33)", count: summary.successCount || 0, color: "#10b981", percent: Math.round(((summary.successCount || 0) / 8) * 100) },
      { label: "Cần theo dõi (1.0 ≤ Cpk < 1.33)", count: summary.warningCount || 0, color: "#f59e0b", percent: Math.round(((summary.warningCount || 0) / 8) * 100) },
      { label: "Nguy hiểm (Cpk < 1.0)", count: summary.dangerCount || 0, color: "#ef4444", percent: Math.round(((summary.dangerCount || 0) / 8) * 100) },
      { label: "Chưa có dữ liệu", count: summary.noDataCount || 0, color: "#94a3b8", percent: Math.round(((summary.noDataCount || 0) / 8) * 100) }
    ];

    box.innerHTML = items.map(item => `
      <div class="breakdown-row">
        <div class="breakdown-top-line">
          <div class="breakdown-label-group">
            <span class="breakdown-dot" style="background: ${item.color};"></span>
            <span>${escapeHtml(item.label)}</span>
          </div>
          <div class="breakdown-val-group">
            <strong>${item.count}</strong> / 8 (${item.percent}%)
          </div>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${item.percent}%; background: ${item.color};"></div>
        </div>
      </div>
    `).join("");
  }

  function renderDefectShareChart(defects, forceRecreate = false) {
    const canvas = document.getElementById("chart-overview-defect-share");
    if (!canvas || typeof Chart === "undefined") return;

    const labels = defects.map(d => `${d.id.replace("defect_", "E")} - ${d.errorName}`);
    const data = defects.map(d => d.oosCount || 0);

    const signature = JSON.stringify(data);
    if (!forceRecreate && chartSignatures["overview-share"] === signature && chartInstances["overview-share"]) return;

    if (chartInstances["overview-share"]) {
      chartInstances["overview-share"].destroy();
    }

    const totalOos = defects.reduce((sum, d) => sum + (d.oosCount || 0), 0);
    const overlayVal = document.getElementById("chart-center-val");
    const overlayLbl = document.getElementById("chart-center-lbl");
    if (overlayVal) overlayVal.textContent = `${totalOos}`;
    if (overlayLbl) overlayLbl.textContent = "Mẫu ngoài quy chuẩn";

    const ctx = canvas.getContext("2d");
    chartInstances["overview-share"] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data.some(v => v > 0) ? data : defects.map(() => 1),
          backgroundColor: [
            "#f14b24", "#3b82f6", "#10b981", "#8b5cf6",
            "#f59e0b", "#ec4899", "#06b6d4", "#64748b"
          ],
          borderWidth: 3,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutoutPercentage: 76,
        legend: { display: false },
        tooltips: {
          backgroundColor: "#0f172a",
          titleFontSize: 12,
          bodyFontSize: 11.5,
          cornerRadius: 4,
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          xPadding: 10,
          yPadding: 8
        }
      }
    });

    chartSignatures["overview-share"] = signature;
  }

  function renderDefectShareBreakdown(defects) {
    const box = document.getElementById("donut-breakdown-box");
    if (!box) return;
    const totalOos = defects.reduce((sum, d) => sum + (d.oosCount || 0), 0) || 1;
    const colors = ["#f14b24", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#64748b"];

    box.innerHTML = defects.map((d, i) => {
      const code = d.id.replace("defect_", "E");
      const count = d.oosCount || 0;
      const pct = Math.round((count / totalOos) * 100);
      const color = colors[i % colors.length];
      return `
        <div class="breakdown-row" style="cursor: pointer;" data-defect-id="${d.id}">
          <div class="breakdown-top-line">
            <div class="breakdown-label-group">
              <span class="breakdown-dot" style="background: ${color};"></span>
              <span><strong>${code}</strong> - ${escapeHtml(d.errorName)}</span>
            </div>
            <div class="breakdown-val-group">
              <strong>${count}</strong> mẫu (${pct}%)
            </div>
          </div>
          <div class="breakdown-bar-bg">
            <div class="breakdown-bar-fill" style="width: ${pct}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join("");

    box.querySelectorAll(".breakdown-row").forEach(row => {
      row.addEventListener("click", () => activateDefectView(row.dataset.defectId));
    });
  }

  function renderOccAlerts(data) {
    const container = document.getElementById("occ-alert-container");
    const countBadge = document.getElementById("occ-count-badge");
    if (!container) return;

    const alerts = data.alertHistory || [];
    container.innerHTML = "";

    if (countBadge) {
      countBadge.textContent = `${alerts.length} vi phạm`;
      countBadge.className = alerts.length > 0 ? "pill-badge pill-danger" : "pill-badge pill-good";
    }

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="empty-alert-state">
          <div class="empty-alert-title">Quy trình trong kiểm soát</div>
          <div class="empty-alert-desc">Không có vi phạm quy tắc SPC nào.</div>
        </div>
      `;
      return;
    }

    alerts.slice(0, 10).forEach(alert => {
      const isDanger = alert.severity === "DANGER";
      const isCritical = alert.severity === "CRITICAL";

      let pillClass = "orange";
      let pillText = "P2 Cảnh báo";
      let cardClass = "severity-warning";

      if (isCritical) {
        pillClass = "pink";
        pillText = "P3 Theo dõi";
        cardClass = "severity-critical";
      } else if (isDanger) {
        pillClass = "red";
        pillText = "P1 Cao";
        cardClass = "severity-danger";
      }

      const matchedDefect = data.defects?.find(d => d.errorName === alert.errorName);
      const defectCode = matchedDefect ? matchedDefect.id.replace("defect_", "E") : "SPC";
      const defectId = matchedDefect ? matchedDefect.id : "defect_1";

      const item = document.createElement("div");
      item.className = `occ-alert-item ${cardClass}`;
      item.title = `Nhấp để xem phân tích SPC cho ${defectCode}`;
      item.innerHTML = `
        <span class="occ-pill ${pillClass}">${pillText}</span>
        <div class="occ-info">
          <div class="occ-top-line">
            <span class="occ-title">${defectCode} - ${escapeHtml(alert.errorName || "Cảnh báo SPC")}</span>
            <span class="occ-time-badge">${escapeHtml(alert.timestamp || "Vừa xong")}</span>
          </div>
          <div class="occ-meta-row">
            <span class="occ-batch-chip">Lô ${escapeHtml(alert.batchId || "--")}</span>
            <span style="color: var(--text-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(alert.message || (alert.value != null ? `Đo: ${alert.value}` : 'Vi phạm SPC'))}</span>
          </div>
        </div>
      `;

      item.addEventListener("click", () => activateDefectView(defectId));
      container.appendChild(item);
    });
  }

  // Lưới 8 Thẻ Giám Sát Nhanh Toàn Bộ Lỗi
  function renderDefectSummaryGrid(defects) {
    const grid = document.getElementById("defect-summary-grid");
    if (!grid) return;

    grid.innerHTML = "";
    defects.forEach(defect => {
      const code = defect.id.replace("defect_", "E");
      const card = document.createElement("div");
      card.className = "defect-summary-card";
      card.dataset.defectId = defect.id;
      card.title = `Nhấp để xem chi tiết biểu đồ SPC ${code} - ${defect.errorName}`;

      let statusBadge = `<span class="pill-badge pill-good">✓ Ổn định</span>`;
      if (defect.status === "DANGER") {
        statusBadge = `<span class="pill-badge pill-danger">⚠ Nguy hiểm</span>`;
      } else if (defect.status === "WARNING") {
        statusBadge = `<span class="pill-badge pill-warning">! Cảnh báo</span>`;
      }

      const canvasId = `sparkline-chart-${defect.id}`;
      card.innerHTML = `
        <div class="defect-card-top">
          <div class="defect-card-code-wrap">
            <span class="defect-code-badge">${code}</span>
            <span class="defect-card-name" title="${escapeHtml(defect.errorName)}">${escapeHtml(defect.errorName)}</span>
          </div>
          ${statusBadge}
        </div>

        <div class="defect-card-metrics">
          <div>
            <div class="defect-card-metric-val" style="color: ${defect.cpk >= 1.33 ? '#10b981' : (defect.cpk >= 1.0 ? '#f59e0b' : '#ef4444')}">
              ${defect.cpk ?? "--"}
            </div>
            <div class="defect-card-metric-lbl">Cpk</div>
          </div>
          <div>
            <div class="defect-card-metric-val">${defect.sigma ?? "--"}</div>
            <div class="defect-card-metric-lbl">&sigma; Sigma</div>
          </div>
          <div>
            <div class="defect-card-metric-val" style="color: ${defect.oosCount > 0 ? '#ef4444' : '#10b981'}">
              ${defect.oosCount || 0}
            </div>
            <div class="defect-card-metric-lbl">Mẫu OOS</div>
          </div>
        </div>

        <div class="defect-sparkline-box">
          <canvas id="${canvasId}"></canvas>
        </div>
      `;

      card.addEventListener("click", () => activateDefectView(defect.id));
      grid.appendChild(card);

      // Render sparkline biểu đồ X-bar thu nhỏ
      renderSparkline(canvasId, defect.means || [], defect.uclX, defect.lclX, defect.xDoubleBar);
    });
  }

  function renderSparkline(canvasId, values, ucl, lcl, cl) {
    window.setTimeout(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === "undefined") return;

      const n = values.length;
      if (n === 0) return;

      const ctx = canvas.getContext("2d");
      const lastVal = values[n - 1];
      const isOut = (ucl != null && lastVal > ucl) || (lcl != null && lastVal < lcl);
      const strokeColor = isOut ? "#ef4444" : "#f14b24";
      const areaGrad = createAreaGradient(ctx, 65, strokeColor, 0.25, 0.0);

      // Điểm phát sáng tại mẫu mới nhất
      const pointRadii = values.map((_, i) => i === n - 1 ? 4 : 0);
      const pointColors = values.map((_, i) => i === n - 1 ? strokeColor : "transparent");

      new Chart(ctx, {
        type: "line",
        data: {
          labels: values.map((_, i) => i + 1),
          datasets: [
            {
              data: values,
              borderColor: strokeColor,
              borderWidth: 2,
              backgroundColor: areaGrad,
              fill: true,
              tension: 0.35,
              pointRadius: pointRadii,
              pointHoverRadius: 5,
              pointBackgroundColor: "#ffffff",
              pointBorderColor: pointColors,
              pointBorderWidth: 2
            },
            {
              data: Array(n).fill(ucl),
              borderColor: "rgba(239, 68, 68, 0.5)",
              borderWidth: 1,
              borderDash: [3, 2],
              pointRadius: 0,
              fill: false
            },
            {
              data: Array(n).fill(lcl),
              borderColor: "rgba(239, 68, 68, 0.5)",
              borderWidth: 1,
              borderDash: [3, 2],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          legend: { display: false },
          tooltips: { enabled: false },
          scales: {
            xAxes: [{ display: false }],
            yAxes: [{ display: false }]
          }
        }
      });
    }, 40);
  }

  /* ==========================================================================
     6. RENDER VIEW 2: SPC TỪNG LỖI (DEFECT DETAIL)
     ========================================================================== */
  function renderSingleDefectDetail(defect) {
    if (!defect) return;

    // Cập nhật trạng thái tổng quan của công đoạn
    const statusPill = document.getElementById("single-defect-status-pill");
    if (statusPill) {
      if (defect.status === "DANGER") {
        statusPill.className = "pill-badge pill-danger";
        statusPill.textContent = "⚠ Nguy hiểm";
      } else if (defect.status === "WARNING") {
        statusPill.className = "pill-badge pill-warning";
        statusPill.textContent = "! Cảnh báo";
      } else {
        statusPill.className = "pill-badge pill-good";
        statusPill.textContent = "✓ Đạt chuẩn";
      }
    }

    // 4 Thẻ KPI trên cùng
    setText("single-usl-val", defect.usl ?? "--");
    setText("single-lsl-val", defect.lsl ?? "--");
    const cpkVal = Number(defect.cpk);
    const lslTrendEl = document.getElementById("single-lsl-trend");
    if (lslTrendEl) {
      if (isNaN(cpkVal) || defect.cpk == null) {
        lslTrendEl.textContent = "Cpk --";
        lslTrendEl.className = "kpi-trend trend-neutral";
      } else if (cpkVal >= 1.33) {
        lslTrendEl.textContent = `Cpk ${cpkVal.toFixed(2)} (Đạt)`;
        lslTrendEl.className = "kpi-trend trend-good";
      } else if (cpkVal >= 1.0) {
        lslTrendEl.textContent = `Cpk ${cpkVal.toFixed(2)} (Cảnh báo)`;
        lslTrendEl.className = "kpi-trend trend-warning";
      } else {
        lslTrendEl.textContent = `Cpk ${cpkVal.toFixed(2)} (Kém)`;
        lslTrendEl.className = "kpi-trend trend-danger";
      }
    }

    const uclStr = defect.uclX != null ? defect.uclX.toFixed(2) : "--";
    const lclStr = defect.lclX != null ? defect.lclX.toFixed(2) : "--";
    setText("single-ucl-lcl-val", `${uclStr} / ${lclStr}`);

    const clStr = defect.xDoubleBar != null ? defect.xDoubleBar.toFixed(2) : "--";
    setText("single-cl-val", clStr);

    // Cập nhật chip giới hạn trên đầu 4 biểu đồ
    const chipX = document.getElementById("limits-chart-x");
    if (chipX) chipX.textContent = `CL: ${clStr} · UCL: ${uclStr} · LCL: ${lclStr}`;

    const chipR = document.getElementById("limits-chart-r");
    const uclRStr = defect.uclR != null ? defect.uclR.toFixed(2) : "--";
    const clRStr = defect.rBar != null ? defect.rBar.toFixed(2) : "--";
    const lclRStr = defect.lclR != null ? defect.lclR.toFixed(2) : "0.00";
    if (chipR) chipR.textContent = `CL: ${clRStr} · UCL: ${uclRStr} · LCL: ${lclRStr}`;

    const chipP = document.getElementById("limits-chart-p");
    const pBarVal = defect.pBar ?? defect.pChart?.centerLine;
    const clPStr = pBarVal != null ? `${(pBarVal * 100).toFixed(1)}%` : "--";
    const uclPVal = defect.uclP ?? (Array.isArray(defect.pChart?.ucl) ? defect.pChart.ucl[defect.pChart.ucl.length - 1] : defect.pChart?.ucl);
    const uclPStr = uclPVal != null ? `${(uclPVal * 100).toFixed(1)}%` : "--";
    if (chipP) chipP.textContent = `CL (p̄): ${clPStr} · UCL: ${uclPStr}`;

    const chipC = document.getElementById("limits-chart-c");
    const cBarVal = defect.cBar ?? defect.cChart?.centerLine;
    const clCStr = cBarVal != null ? Number(cBarVal).toFixed(1) : "--";
    const uclCVal = defect.uclC ?? defect.cChart?.ucl;
    const uclCStr = uclCVal != null ? Number(uclCVal).toFixed(1) : "--";
    if (chipC) chipC.textContent = `CL (c̄): ${clCStr} · UCL: ${uclCStr}`;

    // Chuẩn bị dữ liệu cho 4 biểu đồ kiểm soát theo trình tự thời gian (từ cũ đến mới)
    const rawBatches = defect.batchHistory || [];
    // batchHistory được sắp xếp mới nhất ở đầu -> đảo ngược để vẽ theo trục thời gian từ trái sang phải
    const chronBatches = rawBatches.slice().reverse();

    const labels = chronBatches.length > 0
      ? chronBatches.map(b => formatTimeLabel(b.timestamp) || b.batchId)
      : (defect.times || []).map(t => formatTimeLabel(t));

    const means = chronBatches.length > 0
      ? chronBatches.map(b => b.mean)
      : (defect.means || []);

    const ranges = chronBatches.length > 0
      ? chronBatches.map(b => b.range)
      : (defect.ranges || []);

    const pValues = chronBatches.length > 0
      ? chronBatches.map(b => Number((((b.oosCount || 0) / (b.sampleCount || 10)) * 100).toFixed(1)))
      : (defect.pChart?.values || []).map(v => Number((v * 100).toFixed(1)));

    const cValues = chronBatches.length > 0
      ? chronBatches.map(b => b.oosCount || 0)
      : (defect.cChart?.values || []);

    // 1. Biểu đồ X-bar
    renderControlChart("chart-single-x", "X̄ (Trung bình nhóm)", labels, means, defect.uclX, defect.lclX, defect.xDoubleBar, "#f14b24");

    // 2. Biểu đồ R
    renderControlChart("chart-single-r", "R (Khoảng biến thiên)", labels, ranges, defect.uclR, defect.lclR, defect.rBar, "#3b82f6");

    // 3. Biểu đồ P
    const pUcl = uclPVal != null ? Number((uclPVal * 100).toFixed(2)) : 0;
    const pLcl = 0;
    const pCl = pBarVal != null ? Number((pBarVal * 100).toFixed(2)) : 0;
    renderControlChart("chart-single-p", "P (Tỷ lệ phế phẩm %)", labels, pValues, pUcl, pLcl, pCl, "#8b5cf6");

    // 4. Biểu đồ C
    const cUcl = uclCVal != null ? Number(Number(uclCVal).toFixed(2)) : 0;
    const cLcl = defect.lclC ?? (defect.cChart?.lcl != null ? Number(defect.cChart.lcl) : 0);
    const cCl = cBarVal != null ? Number(Number(cBarVal).toFixed(2)) : 0;
    renderControlChart("chart-single-c", "C (Số lỗi đếm được)", labels, cValues, cUcl, cLcl, cCl, "#10b981");

    // Render bảng lịch sử đo lường và bảng vi phạm
    renderBatchHistoryTable(defect);
    renderDefectViolationsTable(defect);
  }

  function renderControlChart(canvasId, label, labels, values, ucl, lcl, cl, color) {
    window.setTimeout(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === "undefined") return;

      const signature = JSON.stringify({ labels, values, ucl, lcl, cl });
      if (chartSignatures[canvasId] === signature && chartInstances[canvasId]) {
        chartInstances[canvasId].resize();
        return;
      }

      if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
      }

      const n = labels.length;
      const clLine = Array.isArray(cl) ? cl : Array(n).fill(cl);
      const uclLine = Array.isArray(ucl) ? ucl : Array(n).fill(ucl);
      const lclLine = Array.isArray(lcl) ? lcl : Array(n).fill(lcl);

      // Điểm vi phạm phát sáng đỏ rực rỡ, điểm chuẩn tâm trắng viền màu
      const pointColors = values.map((v, i) => {
        const u = Array.isArray(ucl) ? ucl[i] : ucl;
        const l = Array.isArray(lcl) ? lcl[i] : lcl;
        return (v > u || v < l) ? "#ef4444" : "#ffffff";
      });
      const pointBorderColors = values.map((v, i) => {
        const u = Array.isArray(ucl) ? ucl[i] : ucl;
        const l = Array.isArray(lcl) ? lcl[i] : lcl;
        return (v > u || v < l) ? "#ffffff" : color;
      });
      const pointRadii = values.map((v, i) => {
        const u = Array.isArray(ucl) ? ucl[i] : ucl;
        const l = Array.isArray(lcl) ? lcl[i] : lcl;
        return (v > u || v < l) ? 6 : 3.5;
      });
      const pointBorderWidths = values.map((v, i) => {
        const u = Array.isArray(ucl) ? ucl[i] : ucl;
        const l = Array.isArray(lcl) ? lcl[i] : lcl;
        return (v > u || v < l) ? 2.5 : 2;
      });

      const ctx = canvas.getContext("2d");
      const chartHeight = canvas.parentElement?.clientHeight || 240;
      const areaGradient = createAreaGradient(ctx, chartHeight, color, 0.22, 0.0);

      // Plugin phủ dải màu an toàn mờ phía sau đường đồ thị (In-Control Safe Zone)
      const safeZonePlugin = {
        beforeDraw: function(chart) {
          if (!chart.scales["y-axis-0"]) return;
          const yAxis = chart.scales["y-axis-0"];
          const xAxis = chart.scales["x-axis-0"];
          if (!xAxis || !yAxis) return;
          
          const uVal = Array.isArray(ucl) ? ucl[ucl.length - 1] : ucl;
          const lVal = Array.isArray(lcl) ? lcl[lcl.length - 1] : lcl;
          if (uVal == null || lVal == null) return;

          const topPx = yAxis.getPixelForValue(uVal);
          const bottomPx = yAxis.getPixelForValue(lVal);
          const c = chart.ctx;
          c.save();
          c.fillStyle = "rgba(16, 185, 129, 0.038)";
          c.fillRect(xAxis.left, Math.min(topPx, bottomPx), xAxis.right - xAxis.left, Math.abs(bottomPx - topPx));
          c.restore();
        }
      };

      chartInstances[canvasId] = new Chart(ctx, {
        type: "line",
        plugins: [safeZonePlugin],
        data: {
          labels: labels,
          datasets: [
            {
              label: label,
              data: values,
              borderColor: color,
              backgroundColor: areaGradient,
              borderWidth: 2.2,
              pointRadius: pointRadii,
              pointHoverRadius: 7,
              pointBackgroundColor: pointColors,
              pointBorderColor: pointBorderColors,
              pointBorderWidth: pointBorderWidths,
              fill: false,
              lineTension: 0.1
            },
            {
              label: "UCL",
              data: uclLine,
              borderColor: "#ef4444",
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              fill: false
            },
            {
              label: "CL",
              data: clLine,
              borderColor: "#94a3b8",
              borderWidth: 1.2,
              borderDash: [3, 3],
              pointRadius: 0,
              fill: false
            },
            {
              label: "LCL",
              data: lclLine,
              borderColor: "#ef4444",
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          legend: {
            display: true,
            position: "top",
            labels: { fontColor: "#475569", fontSize: 11, boxWidth: 12, fontStyle: "600" }
          },
          tooltips: {
            backgroundColor: "#0f172a",
            titleFontSize: 12,
            bodyFontSize: 11.5,
            cornerRadius: 4,
            borderColor: "rgba(255, 255, 255, 0.12)",
            borderWidth: 1,
            xPadding: 10,
            yPadding: 8,
            callbacks: {
              afterLabel: item => {
                const idx = item.index;
                const v = values[idx];
                const u = Array.isArray(ucl) ? ucl[idx] : ucl;
                const l = Array.isArray(lcl) ? lcl[idx] : lcl;
                if (v > u) return `⚠️ Vi phạm: Vượt UCL (+${(v - u).toFixed(3)})`;
                if (v < l) return `⚠️ Vi phạm: Dưới LCL (-${(l - v).toFixed(3)})`;
                return `✅ Trong giới hạn kiểm soát`;
              }
            }
          },
          scales: {
            xAxes: [{
              gridLines: { display: false },
              ticks: { fontColor: "#64748b", fontSize: 11, padding: 6 }
            }],
            yAxes: [{
              gridLines: { color: "rgba(241, 245, 249, 0.9)", borderDash: [3, 3], drawBorder: false },
              ticks: { fontColor: "#64748b", fontSize: 11, padding: 6 }
            }]
          }
        }
      });

      chartSignatures[canvasId] = signature;
    }, 50);
  }

  function renderBatchHistoryTable(defect) {
    const tbody = document.getElementById("single-batch-body");
    const countEl = document.getElementById("single-batch-count");
    if (!tbody) return;

    const batches = defect.batchHistory || [];
    if (countEl) countEl.textContent = `${batches.length} lô`;

    if (batches.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; color: #8c919d; padding: 24px;">Chưa có dữ liệu lô.</td></tr>`;
      return;
    }

    const usl = defect.usl;
    const lsl = defect.lsl;

    tbody.innerHTML = batches.map(batch => {
      const vals = batch.values || {};
      const oosCount = batch.oosCount || 0;
      const oosBadge = oosCount > 0
        ? `<span class="pill-badge pill-danger">${oosCount} mẫu</span>`
        : `<span class="pill-badge pill-good">0</span>`;

      const oosKeys = new Set((batch.outOfSpecSamples || []).map(s => s.sampleId));

      const xCells = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => {
        const k = `X${i}`;
        const v = vals[k];
        if (v == null) return `<td>-</td>`;
        const isOos = oosKeys.has(k) || (usl != null && v > usl) || (lsl != null && v < lsl);
        if (isOos) {
          return `<td><span class="cell-oos" title="${k}: ${v} ngoài quy chuẩn">${v}</span></td>`;
        }
        return `<td>${v}</td>`;
      }).join("");

      return `
        <tr>
          <td class="lot-code-cell">${escapeHtml(batch.batchId || "--")}</td>
          <td>${escapeHtml(batch.timestamp || "--")}</td>
          ${xCells}
          <td><strong>${batch.mean ?? "-"}</strong></td>
          <td>${batch.range ?? "-"}</td>
          <td>${oosBadge}</td>
        </tr>
      `;
    }).join("");
  }

  function renderDefectViolationsTable(defect) {
    const tbody = document.getElementById("single-violation-body");
    const countEl = document.getElementById("single-violation-count");
    if (!tbody) return;

    const logs = defect.violationLogs || [];
    if (countEl) countEl.textContent = `${logs.length} vi phạm`;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #16a34a; padding: 24px;">✓ Công đoạn này không ghi nhận vi phạm SPC nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td><span class="pill-badge ${log.severity === 'DANGER' ? 'pill-danger' : 'pill-warning'}">${escapeHtml(log.status || 'Vi phạm')}</span></td>
        <td class="lot-code-cell">${escapeHtml(log.batchId || '--')}</td>
        <td>${escapeHtml(log.timestamp || '--')}</td>
        <td>${escapeHtml(log.violationType || '--')}</td>
        <td><strong>${log.value ?? '--'}</strong></td>
      </tr>
    `).join("");
  }

  /* ==========================================================================
     7. RENDER VIEW 3 & 4: NHẬT KÝ VÀ CÀI ĐẶT
     ========================================================================== */
  function renderLogTable(alerts, defects) {
    const tbody = document.getElementById("log-table-body");
    const countEl = document.getElementById("log-total-count");
    if (!tbody) return;

    if (countEl) countEl.textContent = `${alerts.length} sự kiện`;

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #16a34a; padding: 24px;">✓ Toàn hệ thống đang vận hành ổn định, không ghi nhận cảnh báo.</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map(alert => {
      const isDanger = alert.severity === "DANGER";
      const isCritical = alert.severity === "CRITICAL";

      let badge = `<span class="pill-badge pill-warning">P2 Cảnh báo</span>`;
      if (isCritical) {
        badge = `<span class="pill-badge pill-danger" style="background:#be185d; border-color:#f472b6;">P3 Theo dõi</span>`;
      } else if (isDanger) {
        badge = `<span class="pill-badge pill-danger">P1 Cao</span>`;
      }

      const matchedDefect = defects?.find(d => d.errorName === alert.errorName);
      const defectCode = matchedDefect ? matchedDefect.id.replace("defect_", "E") : "SPC";

      return `
        <tr>
          <td>${badge}</td>
          <td><span class="defect-code-badge">${escapeHtml(defectCode)}</span></td>
          <td><strong>${escapeHtml(alert.errorName || "--")}</strong></td>
          <td class="lot-code-cell">${escapeHtml(alert.batchId || "--")}</td>
          <td>${escapeHtml(alert.timestamp || "--")}</td>
          <td>${escapeHtml(alert.message || "--")}</td>
          <td><strong>${alert.value ?? "--"}</strong></td>
        </tr>
      `;
    }).join("");
  }

  function renderSpecsTable(defects) {
    const tbody = document.getElementById("specs-table-body");
    if (!tbody) return;

    if (!defects || defects.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: #8c919d; padding: 24px;">Chưa có dữ liệu quy chuẩn.</td></tr>`;
      return;
    }

    tbody.innerHTML = defects.map(d => {
      const code = d.id.replace("defect_", "E");
      return `
        <tr>
          <td><span class="defect-code-badge">${code}</span></td>
          <td><strong>${escapeHtml(d.errorName || "")}</strong></td>
          <td>${d.lsl ?? "--"}</td>
          <td>${d.usl ?? "--"}</td>
          <td>${d.uclX ?? "--"}</td>
          <td>${d.xDoubleBar ?? "--"}</td>
          <td>${d.lclX ?? "--"}</td>
          <td>${d.uclR ?? "--"}</td>
          <td>${d.rBar ?? "--"}</td>
          <td>${d.lclR ?? "--"}</td>
        </tr>
      `;
    }).join("");
  }

  /* ==========================================================================
     8. ĐIỀU KHIỂN BỘ GIẢ LẬP DỮ LIỆU ẢO (SIMULATOR)
     ========================================================================== */
  function initSimulator() {
    const toggleBtn = document.getElementById("simulatorToggle");
    if (!toggleBtn) return;

    toggleBtn.addEventListener("click", async () => {
      const isRunning = toggleBtn.dataset.running === "true";
      const action = isRunning ? "stop" : "start";
      toggleBtn.disabled = true;
      toggleBtn.querySelector("span") ? (toggleBtn.querySelector("span").textContent = isRunning ? "Đang dừng..." : "Đang bắt đầu...") : (toggleBtn.textContent = isRunning ? "Đang dừng..." : "Đang bắt đầu...");

      try {
        const res = await fetch(`/api/simulator/${action}`, { method: "POST" });
        const result = await res.json();
        updateSimulatorButton(result.running);
        await fetchSpcMatrixData();
      } catch (err) {
        console.error("Lỗi điều khiển bộ giả lập:", err);
      } finally {
        toggleBtn.disabled = false;
      }
    });

    fetch("/api/simulator/status")
      .then(res => res.json())
      .then(status => updateSimulatorButton(status.running))
      .catch(() => {});
  }

  function updateSimulatorButton(running) {
    const btn = document.getElementById("simulatorToggle");
    if (!btn) return;
    btn.dataset.running = String(running);
    const span = btn.querySelector("span");
    if (running) {
      if (span) span.textContent = "Dừng giả lập";
      else btn.textContent = "Dừng giả lập";
      btn.classList.add("running");
    } else {
      if (span) span.textContent = "Giả lập đầu vào";
      else btn.textContent = "Giả lập đầu vào";
      btn.classList.remove("running");
    }
  }

  /* ==========================================================================
     9. TIỆN ÍCH HỖ TRỢ
     ========================================================================== */
  function initTimeUpdater() {
    setInterval(updateLastUpdatedText, 30000);
  }

  function updateLastUpdatedText() {
    const pill = document.getElementById("last-updated-pill");
    const textEl = document.getElementById("live-status-text") || pill;
    if (!textEl) return;
    const diffSec = Math.floor((Date.now() - lastDataTime) / 1000);
    if (diffSec < 60) {
      textEl.textContent = "Cập nhật - Vừa xong";
    } else {
      const mins = Math.floor(diffSec / 60);
      textEl.textContent = `Cập nhật - ${mins} phút trước`;
    }
  }

  function resizeAllCharts() {
    window.setTimeout(() => {
      Object.values(chartInstances).forEach(chart => {
        try { chart.resize(); } catch (e) {}
      });
    }, 100);
  }

  function formatTimeLabel(timeStr) {
    if (!timeStr) return "";
    const cleanStr = String(timeStr).trim();
    const parts = cleanStr.split(/[_ ]/);
    const timePart = parts[0] || cleanStr;
    const timeSegments = timePart.split(":");
    if (timeSegments.length >= 2) {
      return `${timeSegments[0]}:${timeSegments[1]}`;
    }
    return timePart;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpcDashboard);
} else {
  initSpcDashboard();
}
