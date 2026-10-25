/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { runEngineTestSuite, TestCaseResult } from '../engine/testSuite';
import { runEndpointTestSuite, EndpointTestResult } from '../engine/endpointTestSuite';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Server,
  Cpu,
  Code2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const EngineTestRunner: React.FC = () => {
  // Active test mode: 'UNIT' (pure in-memory engine) or 'ENDPOINT' (real HTTP API calls)
  const [activeTab, setActiveTab] = useState<'UNIT' | 'ENDPOINT'>('UNIT');

  // Unit Test State
  const [unitResults, setUnitResults] = useState<TestCaseResult[]>([]);
  const [isUnitRunning, setIsUnitRunning] = useState(false);
  const [unitExecutionTimeMs, setUnitExecutionTimeMs] = useState<number | null>(null);
  const [unitCategoryFilter, setUnitCategoryFilter] = useState<string>('ALL');

  // Endpoint Test State
  const [endpointResults, setEndpointResults] = useState<EndpointTestResult[]>([]);
  const [isEndpointRunning, setIsEndpointRunning] = useState(false);
  const [endpointAvgLatencyMs, setEndpointAvgLatencyMs] = useState<number | null>(null);
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);

  // Execute pure unit calculation tests
  const executeUnitTests = () => {
    setIsUnitRunning(true);
    const start = performance.now();
    setTimeout(() => {
      const suiteResults = runEngineTestSuite();
      const elapsed = performance.now() - start;
      setUnitResults(suiteResults);
      setUnitExecutionTimeMs(parseFloat(elapsed.toFixed(2)));
      setIsUnitRunning(false);
    }, 100);
  };

  // Execute live API endpoint tests via fetch
  const executeEndpointTests = async () => {
    setIsEndpointRunning(true);
    try {
      const results = await runEndpointTestSuite();
      setEndpointResults(results);
      const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);
      setEndpointAvgLatencyMs(results.length > 0 ? parseFloat((totalTime / results.length).toFixed(1)) : 0);
    } catch (err) {
      console.error('Failed to run endpoint tests', err);
    } finally {
      setIsEndpointRunning(false);
    }
  };

  useEffect(() => {
    executeUnitTests();
    executeEndpointTests();
  }, []);

  // Unit Metrics
  const unitTotal = unitResults.length;
  const unitPassed = unitResults.filter((r) => r.passed).length;
  const unitAllPassed = unitTotal > 0 && unitTotal === unitPassed;
  const unitCategories = ['ALL', ...Array.from(new Set(unitResults.map((r) => r.category)))];

  const filteredUnitResults =
    unitCategoryFilter === 'ALL'
      ? unitResults
      : unitResults.filter((r) => r.category === unitCategoryFilter);

  // Endpoint Metrics
  const endpointTotal = endpointResults.length;
  const endpointPassed = endpointResults.filter((r) => r.passed).length;
  const endpointAllPassed = endpointTotal > 0 && endpointTotal === endpointPassed;

  return (
    <div className="space-y-6">
      {/* Top Tab Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 card">
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-lg w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('UNIT')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-mono font-medium rounded-md transition-all ${
              activeTab === 'UNIT'
                ? 'bg-white/10 text-white shadow-xs border border-white/15'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Calculation Engine ({unitTotal})</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                unitAllPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {unitPassed}/{unitTotal}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ENDPOINT')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-mono font-medium rounded-md transition-all ${
              activeTab === 'ENDPOINT'
                ? 'bg-white/10 text-white shadow-xs border border-white/15'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>REST Endpoints ({endpointTotal})</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                endpointAllPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {endpointPassed}/{endpointTotal}
            </span>
          </button>
        </div>

        <div className="text-right px-2">
          <span className="text-[11px] font-mono text-zinc-400">
            Active Currency: <strong className="text-zinc-200">INR (₹)</strong> · Integer Paisa Precision
          </span>
        </div>
      </div>

      {/* VIEW 1: PURE ENGINE UNIT TEST SUITE */}
      {activeTab === 'UNIT' && (
        <div className="space-y-6">
          {/* Unit Suite Summary Banner */}
          <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-[#F8F7F4]">
                  Pure Calculation Engine Verification Suite
                </h3>
                <span
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                    unitAllPassed
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {unitAllPassed ? `ALL ${unitTotal} SCENARIOS PASSED` : 'ATTENTION REQUIRED'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Zero-drift unit tests for integer paise, prime denominators (1/7, 1/11), weighted fractions, common kitty overdrafts, circular settlement simplification, and defensive input validation.
              </p>
            </div>

            <button
              type="button"
              disabled={isUnitRunning}
              onClick={executeUnitTests}
              className="btn flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUnitRunning ? 'animate-spin' : ''}`} />
              <span>{isUnitRunning ? 'Executing...' : 'Re-Run All Scenarios'}</span>
            </button>
          </div>

          {/* Unit Execution Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3.5 text-xs">
              <div className="label">Total Scenarios</div>
              <div className="text-xl font-normal font-mono text-[#F8F7F4] mt-1">{unitTotal}</div>
            </div>
            <div className="card p-3.5 text-xs">
              <div className="label">Passed Tests</div>
              <div className="text-xl font-normal font-mono text-emerald-400 mt-1">{unitPassed}</div>
            </div>
            <div className="card p-3.5 text-xs">
              <div className="label">Failed Tests</div>
              <div className="text-xl font-normal font-mono text-red-400 mt-1">{unitTotal - unitPassed}</div>
            </div>
            <div className="card p-3.5 text-xs">
              <div className="label">Runtime</div>
              <div className="text-xl font-normal font-mono text-indigo-400 mt-1">
                {unitExecutionTimeMs !== null ? `${unitExecutionTimeMs} ms` : '—'}
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-zinc-500 text-xs font-mono mr-1 shrink-0 uppercase tracking-wider">Category:</span>
            {unitCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setUnitCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md font-mono text-xs shrink-0 transition-colors ${
                  unitCategoryFilter === cat
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-white/[0.02] text-zinc-400 border border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Test Cases Accordion / Cards */}
          <div className="space-y-3">
            {filteredUnitResults.map((test, index) => (
              <div
                key={test.id}
                className={`card p-4 transition-all ${
                  test.passed
                    ? 'hover:bg-white/[0.05]'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {test.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-zinc-500">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        <h4 className="text-sm font-medium text-[#F8F7F4]">{test.name}</h4>
                        <span className="text-[10px] font-mono uppercase text-zinc-400 px-2 py-0.5 bg-white/[0.05] border border-white/10 rounded">
                          {test.category}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{test.description}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded font-mono shrink-0 ${
                      test.passed
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-red-400 bg-red-500/10'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                {/* Verification Detail Box */}
                <div className="mt-3 pt-3 border-t border-white/10 font-mono text-xs space-y-1.5 bg-white/[0.02] p-3 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-1">
                    <span className="text-zinc-500">Expected Ground Truth:</span>
                    <span className="text-zinc-300 font-medium">{test.expected}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-1">
                    <span className="text-zinc-500">Engine Actual Output:</span>
                    <span className="text-emerald-400 font-medium">{test.actual}</span>
                  </div>

                  {test.details && (
                    <div className="pt-2 text-[11px] text-zinc-400 font-sans space-y-0.5 border-t border-white/5 mt-2">
                      {test.details.map((d, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-1.5">
                          <span className="text-emerald-400">✔</span>
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE REST API ENDPOINT TEST SUITE */}
      {activeTab === 'ENDPOINT' && (
        <div className="space-y-6">
          {/* Endpoint Banner */}
          <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-[#F8F7F4]">
                  Live HTTP API Endpoint Test Workbench
                </h3>
                <span
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                    endpointAllPassed
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {endpointAllPassed ? `ALL ${endpointTotal} ENDPOINTS VERIFIED` : 'FAILED REQUESTS'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Fires real HTTP network requests from the browser to the backend Node.js / Express engine endpoints. Validates HTTP status codes, JSON response envelopes, defensive error boundaries, and round-trip latency.
              </p>
            </div>

            <button
              type="button"
              disabled={isEndpointRunning}
              onClick={executeEndpointTests}
              className="btn flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isEndpointRunning ? 'animate-spin' : ''}`} />
              <span>{isEndpointRunning ? 'Calling API...' : 'Re-Run Endpoint Tests'}</span>
            </button>
          </div>

          {/* Endpoint Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3.5 text-xs">
              <div className="label">Endpoints Tested</div>
              <div className="text-xl font-normal font-mono text-[#F8F7F4] mt-1">{endpointTotal}</div>
            </div>
            <div className="card p-3.5 text-xs">
              <div className="label">Passed Requests</div>
              <div className="text-xl font-normal font-mono text-emerald-400 mt-1">{endpointPassed}</div>
            </div>
            <div className="card p-3.5 text-xs">
              <div className="label">Failed Requests</div>
              <div className="text-xl font-normal font-mono text-red-400 mt-1">{endpointTotal - endpointPassed}</div>
            </div>
            <div className="card p-3.5 text-xs">
              <div className="label">Avg Latency</div>
              <div className="text-xl font-normal font-mono text-indigo-400 mt-1">
                {endpointAvgLatencyMs !== null ? `${endpointAvgLatencyMs} ms` : '—'}
              </div>
            </div>
          </div>

          {/* Endpoint Test Results */}
          <div className="space-y-3">
            {endpointResults.map((test) => {
              const isExpanded = expandedPayloadId === test.id;

              return (
                <div
                  key={test.id}
                  className={`card p-4 transition-all ${
                    test.passed
                      ? 'hover:bg-white/[0.05]'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {test.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                              test.method === 'GET'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {test.method}
                          </span>
                          <span className="font-mono text-xs font-semibold text-zinc-200">
                            {test.endpoint}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                              test.statusCode === 200
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : test.statusCode === 400
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            HTTP {test.statusCode}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            {test.durationMs}ms
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-[#F8F7F4] mt-1">{test.name}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">{test.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => setExpandedPayloadId(isExpanded ? null : test.id)}
                        className="text-xs font-mono px-2.5 py-1 text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Code2 className="w-3 h-3" />
                        <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded font-mono ${
                          test.passed
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}
                      >
                        {test.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  </div>

                  {/* Assertion Breakdown */}
                  <div className="mt-3 pt-3 border-t border-white/10 font-mono text-xs space-y-1.5 bg-white/[0.02] p-3 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-1">
                      <span className="text-zinc-500">Expected Response:</span>
                      <span className="text-zinc-300 font-medium">{test.expected}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-1">
                      <span className="text-zinc-500">Received Response:</span>
                      <span className="text-emerald-400 font-medium">{test.actual}</span>
                    </div>

                    {test.details && (
                      <div className="pt-2 text-[11px] text-zinc-400 font-sans space-y-0.5 border-t border-white/5 mt-2">
                        {test.details.map((d, dIdx) => (
                          <div key={dIdx} className="flex items-center gap-1.5">
                            <span className="text-emerald-400">✔</span>
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expandable JSON Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      {test.requestPayload && (
                        <div className="bg-black/50 border border-white/10 text-zinc-200 p-3 rounded-lg overflow-x-auto">
                          <div className="label mb-1">
                            HTTP Request Body
                          </div>
                          <pre className="text-[11px] leading-relaxed text-indigo-300">
                            {JSON.stringify(test.requestPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {test.responsePayload && (
                        <div className="bg-black/50 border border-white/10 text-emerald-400 p-3 rounded-lg overflow-x-auto">
                          <div className="label mb-1">
                            HTTP Response Payload
                          </div>
                          <pre className="text-[11px] leading-relaxed">
                            {JSON.stringify(test.responsePayload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
