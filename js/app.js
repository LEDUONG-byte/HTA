document.addEventListener("DOMContentLoaded", () => {
  const chartInstances = {};
  const chartSignatures = {};

  const overviewButton = document.getElementById("tab-button-overview");
  if (overviewButton) {
    overviewButton.addEventListener("click", () => activateDefectTab("overview"));
  }

  const simulatorToggle = document.getElementById("simulatorToggle");
  if (simulatorToggle) {
    simulatorToggle.addEventListener("click", toggleVirtualData);
    loadSimulatorStatus();
  }

  fetchSpcMatrixData();
  connectWebSocket();

  async function loadSimulatorStatus() {
    try {
      const response = await fetch("/api/simulator/status");
      if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
      updateSimulatorControls(await response.json());
    } catch (error) {
      console.error("Lỗi khi tải trạng thái bộ nạp dữ liệu ảo:", error);
      setSimulatorMessage("Không thể kiểm tra trạng thái dữ liệu ảo.");
      if (simulatorToggle) simulatorToggle.disabled = true;
    }
  }

  async function toggleVirtualData() {
    if (!simulatorToggle) return;
    const shouldStart = simulatorToggle.dataset.running !== "true";
    simulatorToggle.disabled = true;
    setSimulatorMessage(shouldStart ? "Đang khởi động dữ liệu ảo..." : "Đang dừng và xóa dữ liệu ảo...");
    try {
      const response = await fetch(`/api/simulator/${shouldStart ? "start" : "stop"}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || `HTTP Status ${response.status}`);
      updateSimulatorControls(result);
      await fetchSpcMatrixData();
    } catch (error) {
      console.error("Lỗi khi thay đổi trạng thái dữ liệu ảo:", error);
      setSimulatorMessage(`Không thể ${shouldStart ? "khởi động" : "dừng"} dữ liệu ảo: ${error.message}`);
      simulatorToggle.disabled = false;
    }
  }

  function updateSimulatorControls(status) {
    if (!simulatorToggle) return;
    const running = status.running === true;
    simulatorToggle.dataset.running = String(running);
    simulatorToggle.disabled = false;
    simulatorToggle.classList.toggle("btn-primary", !running);
    simulatorToggle.classList.toggle("btn-danger", running);
    simulatorToggle.textContent = running ? "Dừng dữ liệu ảo" : "Bắt đầu dữ liệu ảo";
    if (running) {
      setSimulatorMessage(`Đang chạy lô LOT-${String(status.cycle).padStart(6, "0")} (10 mẫu × ${status.checksPerBatch || 8} bước kiểm tra lỗi); chu kỳ ${status.intervalSeconds} giây.`);
    } else if (status.lastError) {
      setSimulatorMessage(`Bộ nạp đã dừng do lỗi: ${status.lastError}`);
    } else {
      setSimulatorMessage("Dữ liệu ảo đang tắt. Nhấn nút để bắt đầu.");
    }
  }

  function setSimulatorMessage(message) {
    const status = document.getElementById("simulatorStatus");
    if (status) status.textContent = message;
  }

  async function fetchSpcMatrixData() {
    try {
      const response = await fetch("/api/spc");
      if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
      renderMatrixDashboard(await response.json());
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu REST API:", error);
      showDataLoadError("Không thể tải dữ liệu SPC từ máy chủ. Hãy kiểm tra API và thử tải lại trang.");
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/dashboard`);

    ws.onmessage = event => {
      try {
        renderMatrixDashboard(JSON.parse(event.data));
      } catch (error) {
        console.error("Lỗi giải mã JSON từ WebSocket:", error);
      }
    };

    ws.onclose = () => {
      window.setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = error => {
      console.error("Lỗi kết nối WebSocket:", error);
      ws.close();
    };
  }

  function renderMatrixDashboard(data) {
    if (!data || !Array.isArray(data.defects)) {
      showDataLoadError("Dữ liệu SPC trả về không đúng định dạng.");
      return;
    }

    const loadStatus = document.getElementById("dataLoadStatus");
    if (loadStatus) {
      loadStatus.hidden = data.defects.length > 0;
      if (data.defects.length === 0) {
        loadStatus.className = "alert alert-info";
        loadStatus.textContent = "API chưa trả về dữ liệu cho loại lỗi nào.";
      }
    }

    if (data.summary) {
      setText("lastUpdated", data.summary.timestamp || "--");
    }

    renderSpecsMatrix(data.defects);
    renderAlertHistory(data.alertHistory || [], data.defects);
    renderOverviewCharts(data.defects);

    const tabsContainer = document.getElementById("defectTabs");
    const tabContent = document.getElementById("defectTabContent");
    const defectTabPanes = document.getElementById("defectTabPanes");
    if (!tabsContainer || !tabContent || !defectTabPanes) return;

    data.defects.forEach(defect => {
      let tabButton = document.getElementById(`tab-button-${defect.id}`);
      let pane = document.getElementById(`tab-pane-${defect.id}`);
      if (!tabButton || !pane) {
        const tabItem = document.createElement("li");
        tabItem.className = "nav-item";
        tabItem.setAttribute("role", "presentation");
        tabButton = document.createElement("button");
        tabButton.type = "button";
        tabButton.id = `tab-button-${defect.id}`;
        tabButton.className = "nav-link";
        tabButton.setAttribute("role", "tab");
        tabButton.setAttribute("aria-controls", `tab-pane-${defect.id}`);
        tabButton.setAttribute("aria-selected", "false");
        tabButton.title = defect.errorName;
        tabButton.innerHTML = `${escapeHtml(defect.id.replace("defect_", "E"))}<span class="spc-tab-status spc-tab-status-${escapeHtml(defect.status)}" aria-label="${escapeHtml(defect.statusText)}"></span>`;
        tabButton.addEventListener("click", () => activateDefectTab(defect.id));
        tabItem.appendChild(tabButton);
        tabsContainer.appendChild(tabItem);

        pane = document.createElement("div");
        pane.id = `tab-pane-${defect.id}`;
        pane.className = "tab-pane";
        pane.setAttribute("role", "tabpanel");
        pane.setAttribute("aria-labelledby", tabButton.id);
        pane.innerHTML = createDefectDetailTemplate(defect);
        defectTabPanes.appendChild(pane);
      } else {
        tabButton.title = defect.errorName;
        const statusDot = tabButton.querySelector(".spc-tab-status");
        if (statusDot) {
          statusDot.className = `spc-tab-status spc-tab-status-${escapeHtml(defect.status)}`;
          statusDot.setAttribute("aria-label", defect.statusText);
        }
        updateTileValues(defect);
      }
      renderSpecsMatrix([defect], `specs-${defect.id}`, false);
      renderViolationLog(defect.violationLogs || [], `logs-${defect.id}`, false);
      renderBatchHistory(defect);
      renderMiniCharts(defect);
    });
  }

  function activateDefectTab(defectId) {
    const isOverview = defectId === "overview";
    document.querySelectorAll("#defectTabs .nav-link").forEach(button => {
      const active = button.id === `tab-button-${defectId}`;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const overviewPane = document.getElementById("tab-pane-overview");
    if (overviewPane) {
      overviewPane.classList.toggle("active", isOverview);
      overviewPane.classList.toggle("show", isOverview);
    }
    document.querySelectorAll("#defectTabPanes .tab-pane").forEach(pane => {
      const active = pane.id === `tab-pane-${defectId}`;
      pane.classList.toggle("active", active);
      pane.classList.toggle("show", active);
      if (active) {
        Object.entries(chartInstances).forEach(([key, chart]) => {
          if (key.startsWith(`${defectId}-`)) chart.resize();
        });
      }
    });
    if (isOverview) {
      Object.entries(chartInstances).forEach(([key, chart]) => {
        if (key.startsWith("overview-")) chart.resize();
      });
    }
    document.getElementById("defectTabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function createDefectDetailTemplate(defect) {
    return `
      <div id="card-${defect.id}" class="spc-defect-card">${createTileTemplate(defect)}</div>
      <div class="row row-sm mg-t-20">
        <div class="col-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mg-b-0">Lịch sử giá trị theo lô · ${escapeHtml(defect.errorName)}</h5>
              <span id="batch-history-count-${defect.id}" class="badge badge-secondary">0</span>
            </div>
            <div class="table-responsive spc-history-table">
              <table class="table table-hover table-sm mg-b-0">
                <thead><tr><th>Lô</th><th>Thời gian</th><th>X1</th><th>X2</th><th>X3</th><th>X4</th><th>X5</th><th>X6</th><th>X7</th><th>X8</th><th>X9</th><th>X10</th><th>Trung bình</th><th>Khoảng</th><th>OOS</th><th>Trạng thái</th></tr></thead>
                <tbody id="batch-history-${defect.id}">
                  <tr><td colspan="16" class="text-center text-muted">Đang tải lịch sử lô...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="row row-sm mg-t-20">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mg-b-0">Quy chuẩn kỹ thuật &amp; giới hạn SPC</h5>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mg-b-0">
                <thead><tr><th>LSL</th><th>USL</th><th>UCL X-bar</th><th>CL X-bar</th><th>LCL X-bar</th><th>UCL R</th><th>CL R</th><th>LCL R</th></tr></thead>
                <tbody id="specs-${defect.id}"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="row row-sm mg-t-20">
        <div class="col-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mg-b-0">Lịch sử vi phạm SPC · ${escapeHtml(defect.errorName)}</h5>
              <span id="logs-count-${defect.id}" class="badge badge-secondary">0</span>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mg-b-0">
                <thead><tr><th>Mốc thời gian</th><th>Giá trị đo</th><th>Loại vi phạm</th><th>Trạng thái</th></tr></thead>
                <tbody id="logs-${defect.id}"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }

  function showDataLoadError(message) {
    const loadStatus = document.getElementById("dataLoadStatus");
    if (!loadStatus) return;
    loadStatus.className = "alert alert-danger";
    loadStatus.textContent = message;
    loadStatus.hidden = false;
  }

  function createTileTemplate(defect) {
    const badgeClass = getCpkBadgeClass(defect.cpk, defect.status);
    const oosRate = getOosRate(defect);
    return `
      <div class="card card-dashboard-two defect-card card-border-${escapeHtml(defect.status)} pd-15">
        <div class="d-flex justify-content-between align-items-center mg-b-10">
          <h6 class="tx-14 font-weight-bold mg-b-0 text-truncate" title="${escapeHtml(defect.errorName)}">${escapeHtml(defect.errorName)}</h6>
          <span id="badge-status-${defect.id}" class="badge ${badgeClass}">${escapeHtml(getCpkStatusText(defect))}</span>
        </div>
        <div class="spc-kpi">
          <div class="d-flex align-items-end justify-content-between">
            <div>
              <span class="tx-11 tx-gray-500 d-block">Cpk hiện tại</span>
              <strong id="val-cpk-${defect.id}" class="spc-cpk-value ${badgeClass}">${escapeHtml(defect.cpk)}</strong>
            </div>
            <div class="text-right tx-12">
              <div>Cp <strong id="val-cp-${defect.id}">${escapeHtml(defect.cp)}</strong></div>
              <div>&sigma; <strong id="val-sigma-${defect.id}">${escapeHtml(defect.sigma)}</strong></div>
            </div>
          </div>
        </div>
        <div class="mg-t-10">
          <div class="d-flex justify-content-between tx-11">
            <span>OOS / Tổng mẫu</span>
            <strong id="val-oos-${defect.id}" class="${defect.oosCount > 0 ? "tx-danger" : "tx-gray-700"}">${defect.oosCount} / ${defect.totalCount}</strong>
          </div>
          <div class="progress spc-oos-progress">
            <div id="progress-oos-${defect.id}" class="progress-bar ${defect.oosCount > 0 ? "bg-danger" : "bg-success"}" role="progressbar" style="width: ${oosRate}%" aria-valuenow="${oosRate}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </div>
        <div class="tx-11 mg-t-5">Vi phạm SPC: <strong id="val-violations-${defect.id}">${defect.spcViolationsCount}</strong></div>
        <div class="spc-chart-section">
          <div class="d-flex justify-content-between align-items-center">
            <strong class="tx-11">X-bar Chart</strong>
            <span class="tx-10 text-muted">${formatLimits(defect.xDoubleBar, defect.uclX, defect.lclX)}</span>
          </div>
          <div class="mini-chart-box"><canvas id="chart-x-${defect.id}"></canvas></div>
          <div class="d-flex justify-content-between align-items-center">
            <strong class="tx-11">R Chart</strong>
            <span class="tx-10 text-muted">${formatLimits(defect.rBar, defect.uclR, defect.lclR)}</span>
          </div>
          <div class="mini-chart-box"><canvas id="chart-r-${defect.id}"></canvas></div>
          <div class="d-flex justify-content-between align-items-center">
            <strong class="tx-11" title="Tỷ lệ mẫu ngoài quy chuẩn trên tổng mẫu của từng lô">P Chart · Tỷ lệ mẫu OOS</strong>
            <span class="tx-10 text-muted">${formatProportionLimits(defect.pChart)}</span>
          </div>
          <div class="mini-chart-box"><canvas id="chart-p-${defect.id}"></canvas></div>
          <div class="d-flex justify-content-between align-items-center">
            <strong class="tx-11" title="Số mẫu ngoài quy chuẩn trong mỗi lô">C Chart · Số mẫu OOS/lô</strong>
            <span class="tx-10 text-muted">${formatLimits(defect.cChart?.centerLine, defect.cChart?.ucl, defect.cChart?.lcl)}</span>
          </div>
          <div class="mini-chart-box"><canvas id="chart-c-${defect.id}"></canvas></div>
        </div>
        <div class="d-flex justify-content-between align-items-center mg-t-5 pd-t-5 border-top tx-11 tx-gray-500">
          <span>LSL: <strong>${escapeHtml(defect.lsl)}</strong></span>
          <span>USL: <strong>${escapeHtml(defect.usl)}</strong></span>
        </div>
      </div>
    `;
  }

  function updateTileValues(defect) {
    const cardContainer = document.getElementById(`card-${defect.id}`);
    const card = cardContainer ? cardContainer.firstElementChild : null;
    const badge = document.getElementById(`badge-status-${defect.id}`);
    const cpk = document.getElementById(`val-cpk-${defect.id}`);
    const cp = document.getElementById(`val-cp-${defect.id}`);
    const sigma = document.getElementById(`val-sigma-${defect.id}`);
    const oos = document.getElementById(`val-oos-${defect.id}`);
    const violations = document.getElementById(`val-violations-${defect.id}`);
    const progress = document.getElementById(`progress-oos-${defect.id}`);
    const badgeClass = getCpkBadgeClass(defect.cpk, defect.status);

    if (card) {
      card.classList.remove("card-border-SUCCESS", "card-border-WARNING", "card-border-DANGER", "card-border-NO_DATA");
      card.classList.add(`card-border-${defect.status}`);
    }
    if (badge) {
      badge.className = `badge ${badgeClass}`;
      badge.textContent = getCpkStatusText(defect);
    }
    if (cpk) {
      cpk.className = `spc-cpk-value ${badgeClass}`;
      cpk.textContent = defect.cpk;
    }
    if (cp) cp.textContent = defect.cp;
    if (sigma) sigma.textContent = defect.sigma;
    if (oos) {
      oos.textContent = `${defect.oosCount} / ${defect.totalCount}`;
      oos.className = defect.oosCount > 0 ? "tx-danger" : "tx-gray-700";
    }
    if (violations) violations.textContent = defect.spcViolationsCount;
    if (progress) {
      const rate = getOosRate(defect);
      progress.style.width = `${rate}%`;
      progress.setAttribute("aria-valuenow", rate);
      progress.className = `progress-bar ${defect.oosCount > 0 ? "bg-danger" : "bg-success"}`;
    }
    if (cardContainer) {
      const title = cardContainer.querySelector(".defect-card h6");
      if (title) {
        title.textContent = defect.errorName;
        title.title = defect.errorName;
      }
      const limits = cardContainer.querySelectorAll(".spc-chart-section .tx-10");
      if (limits.length === 4) {
        limits[0].textContent = formatLimits(defect.xDoubleBar, defect.uclX, defect.lclX);
        limits[1].textContent = formatLimits(defect.rBar, defect.uclR, defect.lclR);
        limits[2].textContent = formatProportionLimits(defect.pChart);
        limits[3].textContent = formatLimits(
          defect.cChart?.centerLine,
          defect.cChart?.ucl,
          defect.cChart?.lcl
        );
      }
      const specs = cardContainer.querySelector(".defect-card .border-top");
      if (specs) {
        specs.replaceChildren(
          createSpecLabel("LSL", defect.lsl),
          createSpecLabel("USL", defect.usl)
        );
      }
    }
  }

  function createSpecLabel(label, value) {
    const span = document.createElement("span");
    span.append(`${label}: `);
    const strong = document.createElement("strong");
    strong.textContent = value ?? "--";
    span.appendChild(strong);
    return span;
  }

  function renderMiniCharts(defect) {
    const labels = defect.times || [];
    renderControlChart(defect, "x", labels, defect.means || [], defect.xDoubleBar, defect.uclX, defect.lclX);
    renderControlChart(defect, "r", labels, defect.ranges || [], defect.rBar, defect.uclR, defect.lclR);
    const pChart = defect.pChart || {};
    renderControlChart(defect, "p", labels, pChart.values || [], pChart.centerLine, pChart.ucl || [], pChart.lcl || []);
    const cChart = defect.cChart || {};
    renderControlChart(defect, "c", labels, cChart.values || [], cChart.centerLine, cChart.ucl, cChart.lcl);
  }

  function renderControlChart(defect, chartType, labels, values, centerLine, ucl, lcl) {
    const key = `${defect.id}-${chartType}`;
    const canvas = document.getElementById(`chart-${chartType}-${defect.id}`);
    if (!canvas) return;

    const seriesColor = defect.status === "DANGER" ? "#dc3545" : "#007bff";
    const yAxisTicks = { fontSize: 9 };
    if (chartType === "p") {
      yAxisTicks.callback = value => `${(value * 100).toFixed(0)}%`;
    }
    const dataLines = [
      values,
      Array(labels.length).fill(centerLine),
      Array.isArray(ucl) ? ucl : Array(labels.length).fill(ucl),
      Array.isArray(lcl) ? lcl : Array(labels.length).fill(lcl)
    ];
    const signature = JSON.stringify([labels, dataLines, seriesColor]);
    if (chartInstances[key]) {
      if (chartSignatures[key] === signature) return;
      const chart = chartInstances[key];
      chart.data.labels = labels;
      dataLines.forEach((line, index) => {
        chart.data.datasets[index].data = line;
      });
      chart.data.datasets[0].borderColor = seriesColor;
      chart.update();
      chartSignatures[key] = signature;
      return;
    }

    chartInstances[key] = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: { x: "X-bar", r: "R", p: "P", c: "C" }[chartType],
            data: dataLines[0],
            borderColor: seriesColor,
            borderWidth: 2,
            fill: false,
            pointRadius: 2
          },
          {
            label: "CL",
            data: dataLines[1],
            borderColor: "#6c757d",
            borderDash: [2, 2],
            borderWidth: 1,
            fill: false,
            pointRadius: 0
          },
          {
            label: "UCL",
            data: dataLines[2],
            borderColor: "#dc3545",
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0
          },
          {
            label: "LCL",
            data: dataLines[3],
            borderColor: "#dc3545",
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          xAxes: [{ display: false }],
          yAxes: [{
            ticks: yAxisTicks
          }]
        }
      }
    });
    chartSignatures[key] = signature;
  }

  function renderSpecsMatrix(defects, bodyId = "specsMatrixBody", includeCode = true) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.replaceChildren();
    if (defects.length === 0) {
      appendEmptyRow(body, includeCode ? 10 : 8, "Chưa có dữ liệu quy chuẩn.");
      return;
    }
    defects.forEach(defect => {
      const row = document.createElement("tr");
      const values = [
        ...(includeCode ? [defect.id.replace("defect_", "E"), defect.errorName] : []),
        defect.lsl, defect.usl,
        defect.uclX, defect.xDoubleBar, defect.lclX,
        defect.uclR, defect.rBar, defect.lclR
      ];
      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "--";
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function renderViolationLog(logs, bodyId = "violationLogBody", includeCode = true) {
    const body = document.getElementById(bodyId);
    const count = document.getElementById(bodyId === "violationLogBody" ? "violationLogCount" : bodyId.replace("logs-", "logs-count-"));
    if (!body) return;
    body.replaceChildren();
    if (count) count.textContent = logs.length;
    if (logs.length === 0) {
      appendEmptyRow(body, includeCode ? 5 : 4, "Chưa có vi phạm SPC.");
      return;
    }
    [...logs].sort((left, right) =>
      getTimestampSortValue(right.timestamp) - getTimestampSortValue(left.timestamp)
    ).forEach(log => {
      const row = document.createElement("tr");
      const values = [
        ...(includeCode ? [log.errorCode || "--"] : []),
        log.timestamp,
        log.value,
        log.violationType,
        log.status
      ];
      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "--";
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function renderBatchHistory(defect) {
    const body = document.getElementById(`batch-history-${defect.id}`);
    const count = document.getElementById(`batch-history-count-${defect.id}`);
    if (!body) return;
    const history = [...(defect.batchHistory || [])].sort((left, right) =>
      getTimestampSortValue(right.timestamp) - getTimestampSortValue(left.timestamp)
    );
    if (count) count.textContent = history.length;
    body.replaceChildren();
    if (history.length === 0) {
      appendEmptyRow(body, 16, "Chưa có dữ liệu theo lô.");
      return;
    }
    history.forEach(batch => {
      const row = document.createElement("tr");
      const statusLabels = {
        DANGER: "NGUY HIỂM",
        WARNING: "CẢNH BÁO",
        NORMAL: "BÌNH THƯỜNG"
      };
      const values = [
        batch.batchId,
        batch.timestamp,
        ...Array.from({ length: 10 }, (_, index) => {
          const value = batch.values?.[`X${index + 1}`];
          return batch.isVirtual && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : value ?? "--";
        }),
        batch.isVirtual ? Number(batch.mean).toFixed(2) : batch.mean,
        batch.isVirtual ? Number(batch.range).toFixed(2) : batch.range,
        batch.oosCount,
        statusLabels[batch.status] || batch.status
      ];
      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "--";
        row.appendChild(cell);
      });
      if (batch.status === "DANGER") row.className = "table-danger";
      else if (batch.status === "WARNING") row.className = "table-warning";
      body.appendChild(row);
    });
  }

  function renderAlertHistory(alerts, defects) {
    const body = document.getElementById("alertHistoryBody");
    const count = document.getElementById("alertHistoryCount");
    if (!body) return;
    const defectByName = new Map(defects.map(defect => [defect.errorName, defect]));
    const sortedAlerts = [...alerts].sort((left, right) =>
      getTimestampSortValue(right.timestamp) - getTimestampSortValue(left.timestamp)
    );
    if (count) count.textContent = sortedAlerts.length;
    body.replaceChildren();
    if (sortedAlerts.length === 0) {
      appendEmptyRow(body, 6, "Chưa có cảnh báo hoặc nguy hiểm.");
      return;
    }
    sortedAlerts.forEach(alert => {
      const defect = defectByName.get(alert.errorName);
      const row = document.createElement("tr");
      const severityCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge ${alert.severity === "DANGER" ? "badge-danger" : "badge-warning"}`;
      badge.textContent = alert.severity === "DANGER" ? "NGUY HIỂM" : "CẢNH BÁO";
      severityCell.appendChild(badge);
      row.appendChild(severityCell);
      [
        defect?.id.replace("defect_", "E") || "--",
        alert.errorName,
        alert.timestamp,
        alert.message,
        alert.value
      ].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "--";
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function getTimestampSortValue(timestamp) {
    const match = String(timestamp).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?_(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return Number.MIN_SAFE_INTEGER;
    const [, hour, minute, second = "0", day, month, year] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime();
  }

  function renderOverviewCharts(defects) {
    const statusCounts = ["SUCCESS", "WARNING", "DANGER", "NO_DATA"].map(status =>
      defects.filter(defect => defect.status === status).length
    );
    updateOverviewChart("overview-status", "chart-overview-status", {
      type: "doughnut",
      data: {
        labels: ["Ổn định", "Cảnh báo", "Nguy hiểm", "Chưa có dữ liệu"],
        datasets: [{
          data: statusCounts,
          backgroundColor: ["#10b759", "#ffc107", "#dc3545", "#8392a5"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { position: "bottom" }
      }
    });

    const labels = defects.map(defect => defect.id.replace("defect_", "E"));
    const cpk = defects.map(defect => defect.status === "NO_DATA" ? null : Number(defect.cpk));
    updateOverviewChart("overview-cpk", "chart-overview-cpk", {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Cpk",
            data: cpk,
            backgroundColor: defects.map(defect => (
              defect.status === "DANGER" ? "rgba(220, 53, 69, 0.7)"
                : defect.status === "WARNING" ? "rgba(255, 193, 7, 0.75)"
                  : defect.status === "NO_DATA" ? "rgba(131, 146, 165, 0.5)"
                    : "rgba(16, 183, 89, 0.7)"
            )),
            borderColor: defects.map(defect => (
              defect.status === "DANGER" ? "#dc3545"
                : defect.status === "WARNING" ? "#e0a800"
                  : defect.status === "NO_DATA" ? "#8392a5"
                    : "#10b759"
            )),
            borderWidth: 1
          },
          {
            type: "line",
            label: "Ngưỡng 1.00",
            data: Array(labels.length).fill(1),
            borderColor: "#e0a800",
            borderDash: [5, 4],
            borderWidth: 1,
            fill: false,
            pointRadius: 0
          },
          {
            type: "line",
            label: "Ngưỡng 1.33",
            data: Array(labels.length).fill(1.33),
            borderColor: "#10b759",
            borderDash: [5, 4],
            borderWidth: 1,
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: true, position: "bottom" },
        scales: {
          xAxes: [{ stacked: false }],
          yAxes: [{ ticks: { beginAtZero: true, suggestedMax: 1.6 } }]
        }
      }
    });

    updateOverviewChart("overview-oos", "chart-overview-oos", {
      type: "horizontalBar",
      data: {
        labels,
        datasets: [{
          label: "OOS (%)",
          data: defects.map(getOosRate),
          backgroundColor: defects.map(defect => defect.oosCount > 0 ? "rgba(220, 53, 69, 0.7)" : "rgba(16, 183, 89, 0.7)"),
          borderColor: defects.map(defect => defect.oosCount > 0 ? "#dc3545" : "#10b759"),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          xAxes: [{ ticks: { beginAtZero: true, max: 100, callback: value => `${value}%` } }],
          yAxes: [{ ticks: { autoSkip: false } }]
        },
        tooltips: {
          callbacks: { label: item => `${item.xLabel}% OOS` }
        }
      }
    });

    const defectBatchCounts = defects.map(defect =>
      (defect.batchHistory || []).filter(batch => batch.status === "DANGER").length
    );
    const totalDefectBatches = defectBatchCounts.reduce((total, count) => total + count, 0);
    const defectShareLabels = defects.map((defect, index) => {
      const code = defect.id.replace("defect_", "E");
      const share = totalDefectBatches > 0 ? (defectBatchCounts[index] / totalDefectBatches) * 100 : 0;
      return `${code} (${share.toFixed(1)}%)`;
    });
    updateOverviewChart("overview-defect-share", "chart-overview-defect-share", {
      type: "doughnut",
      data: {
        labels: defectShareLabels,
        datasets: [{
          data: defectBatchCounts,
          backgroundColor: ["#dc3545", "#fd7e14", "#ffc107", "#20c997", "#17a2b8", "#007bff", "#6610f2", "#6f42c1"],
          borderColor: "#fff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { position: "bottom" },
        tooltips: {
          callbacks: {
            label: item => {
              const count = defectBatchCounts[item.index];
              const share = totalDefectBatches > 0 ? (count / totalDefectBatches) * 100 : 0;
              return `${defectShareLabels[item.index]}: ${count} lô (${share.toFixed(1)}%)`;
            }
          }
        }
      }
    });
  }

  function updateOverviewChart(key, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const signature = JSON.stringify(config.data);
    if (chartInstances[key]) {
      if (chartSignatures[key] === signature) return;
      chartInstances[key].data = config.data;
      chartInstances[key].update();
      chartSignatures[key] = signature;
      return;
    }
    chartInstances[key] = new Chart(canvas, config);
    chartSignatures[key] = signature;
  }

  function appendEmptyRow(body, columnCount, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.className = "text-center text-muted";
    cell.textContent = message;
    row.appendChild(cell);
    body.appendChild(row);
  }

  function getCpkBadgeClass(cpk, status) {
    if (status === "NO_DATA") return "bg-secondary text-white";
    if (cpk >= 1.33) return "bg-success text-white";
    if (cpk >= 1.0) return "bg-warning text-dark";
    return "bg-danger text-white";
  }

  function getCpkStatusText(defect) {
    if (defect.status === "NO_DATA") return defect.statusText;
    if (defect.cpk >= 1.33) return "Cpk đạt chuẩn tốt";
    if (defect.cpk >= 1.0) return "Cpk cần theo dõi";
    return "Cpk nguy hiểm";
  }

  function getOosRate(defect) {
    return defect.totalCount > 0
      ? Math.min(100, (defect.oosCount / defect.totalCount) * 100)
      : 0;
  }

  function formatLimits(center, upper, lower) {
    return `CL ${center} · UCL ${upper} · LCL ${lower}`;
  }

  function formatProportionLimits(chart) {
    if (!chart || chart.ucl.length === 0 || chart.lcl.length === 0) return "Chưa có dữ liệu";
    const lastIndex = chart.ucl.length - 1;
    const asPercent = value => `${(value * 100).toFixed(1)}%`;
    return `CL ${asPercent(chart.centerLine)} · UCL ${asPercent(chart.ucl[lastIndex])} · LCL ${asPercent(chart.lcl[lastIndex])}`;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }
});
