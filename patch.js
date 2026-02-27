const fs = require('fs');
const tsxFile = 'client/src/components/trends/TagTrendsDashboard.tsx';
let tsx = fs.readFileSync(tsxFile, 'utf8');

// 1. Tag Color Calculation
tsx = tsx.replace(
  "const stats: Record<string, { name: string, amount: number, count: number }> = {}; \n    const daily: Record<string, Record<string, number>> = {};",
  `const stats: Record<string, { name: string, amount: number, count: number }> = {}; 
    const daily: Record<string, Record<string, number>> = {};
    const tagCatCount: Record<string, Record<string, number>> = {};`
);

tsx = tsx.replace(
  "daily[day][tag] = (daily[day][tag] || 0) + 1; // Frequency per day",
  `daily[day][tag] = (daily[day][tag] || 0) + 1;
        if (!tagCatCount[tag]) tagCatCount[tag] = {};
        tagCatCount[tag][t.category] = (tagCatCount[tag][t.category] || 0) + 1;`
);

tsx = tsx.replace(
  "const allTagsList = sortedTags.map(t => t.name);",
  `const allTagsList = sortedTags.map(t => t.name);
    
    const tagColors: Record<string, string> = {};
    Object.keys(tagCatCount).forEach(tag => {
      let bestCat = "";
      let max = -1;
      Object.entries(tagCatCount[tag]).forEach(([cat, count]) => {
        if (count > max) { max = count; bestCat = cat; }
      });
      tagColors[tag] = getCategoryColor(bestCat, categories);
    });`
);

// Replace mapping color with tagColors lookup
tsx = tsx.replace(
  "color: COLOR_PALETTE[i % COLOR_PALETTE.length]",
  "color: tagColors[t.name]"
);
tsx = tsx.replace(
  "color: COLOR_PALETTE[i % COLOR_PALETTE.length]",
  "color: tagColors[t.name]"
);
tsx = tsx.replace(
  "color: COLOR_PALETTE[i % COLOR_PALETTE.length]",
  "color: tagColors[t.name]"
);

// We still need to return tagColors to be used by other parts of the component
tsx = tsx.replace(
  "dailyData: daily,",
  "dailyData: daily,\n      tagColors,"
);

// Extract tagColors
tsx = tsx.replace(
  "const { rankingData, scatterData, quadrantLines, wordCloudData, dailyData, allTags }",
  "const { rankingData, scatterData, quadrantLines, wordCloudData, dailyData, allTags, tagColors }"
);

// Select Component color options
tsx = tsx.replace(
  "options={allTags.map((tag, i) => ({ value: tag, label: \`#\${tag}\`, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }))}",
  "options={allTags.map((tag) => ({ value: tag, label: \`#\${tag}\`, color: tagColors[tag] }))}"
);

// hexToRGB and getHeatmapColor
const getHeatmapColorOld = `  const getHeatmapColor = (count: number) => {
    if (count < 0) return 'transparent'; // empty placeholder
    if (count === 0) return isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(241, 245, 249, 1)';
    if (count === 1) return 'rgba(99, 102, 241, 0.3)';
    if (count === 2) return 'rgba(99, 102, 241, 0.6)'; 
    return 'rgba(99, 102, 241, 1)'; 
  };`;

const getHeatmapColorNew = `  const hexToRgb = (hex: string) => {
    if (!hex) return '99, 102, 241';
    let c = hex.substring(1);
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const r = parseInt(c.substring(0,2), 16);
    const g = parseInt(c.substring(2,4), 16);
    const b = parseInt(c.substring(4,6), 16);
    return \`\${r}, \${g}, \${b}\`;
  };

  const getHeatmapColor = (count: number, tag: string) => {
    if (count < 0) return 'transparent'; // empty placeholder
    if (count === 0) return isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(241, 245, 249, 1)';
    const rgb = hexToRgb(tagColors[tag]);
    if (count === 1) return \`rgba(\${rgb}, 0.3)\`;
    if (count === 2) return \`rgba(\${rgb}, 0.6)\`; 
    return \`rgba(\${rgb}, 1)\`; 
  };`;
tsx = tsx.replace(getHeatmapColorOld, getHeatmapColorNew);

// Update heatmap render usage
tsx = tsx.replace(/getHeatmapColor\(day\.count\)/g, "getHeatmapColor(day.count, heatmapTag)");

// Legend Colors update
const legendOld = `<div className="heatmap-legend-cell" style={{ backgroundColor: 'rgba(99, 102, 241, 0.3)' }} />
              <div className="heatmap-legend-cell" style={{ backgroundColor: 'rgba(99, 102, 241, 0.6)' }} />
              <div className="heatmap-legend-cell" style={{ backgroundColor: 'rgba(99, 102, 241, 1)' }} />`;
const legendNew = `<div className="heatmap-legend-cell" style={{ backgroundColor: \`rgba(\${hexToRgb(tagColors[heatmapTag])}, 0.3)\` }} />
              <div className="heatmap-legend-cell" style={{ backgroundColor: \`rgba(\${hexToRgb(tagColors[heatmapTag])}, 0.6)\` }} />
              <div className="heatmap-legend-cell" style={{ backgroundColor: \`rgba(\${hexToRgb(tagColors[heatmapTag])}, 1)\` }} />`;
tsx = tsx.replace(legendOld, legendNew);

// Single week Top 3 replacement
const singleWeekOld = `{/* 增加 Top 2/3 热力图补充单周模式下的空白 */}
                {allTags.slice(1, 3).map(tag => {
                  const tagData = heatmapGridData[0]?.map(day => {
                    const count = dailyData[day.date]?.[tag] || 0;
                    return { ...day, count };
                  });
                  return (
                    <div className="heatmap-single-week" key={tag}>
                      <div className="heatmap-single-week-header" style={{opacity: 0.6}}>
                        <span style={{width: 'auto', minWidth: '40px', paddingRight: '8px', textAlign: 'left', fontWeight: 'bold'}}>#{tag}</span>
                      </div>
                      <div className="heatmap-single-week-row">
                        {tagData?.map((day) => (
                          <div 
                            key={day.id} 
                            className="heatmap-cell" 
                            style={{ backgroundColor: getHeatmapColor(day.count) }} 
                            data-tooltip={\`\${day.date}: \${day.count} 次 (#\${tag})\`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}`;

const singleWeekNew = `<div className="text-xs mt-3 mb-1 font-bold" style={{color: 'var(--text-secondary)'}}>Top 3 标签</div>
                {allTags.slice(0, 3).map(tag => {
                  const tagData = heatmapGridData[0]?.map(day => {
                    const count = dailyData[day.date]?.[tag] || 0;
                    return { ...day, count };
                  });
                  return (
                    <div className="heatmap-single-week" key={tag}>
                      <div className="heatmap-single-week-header" style={{opacity: 0.8}}>
                        <span style={{width: 'auto', minWidth: '40px', paddingRight: '8px', textAlign: 'left', fontWeight: 'bold', color: tagColors[tag]}}>#{tag}</span>
                      </div>
                      <div className="heatmap-single-week-row">
                        {tagData?.map((day) => (
                          <div 
                            key={day.id} 
                            className="heatmap-cell" 
                            style={{ backgroundColor: getHeatmapColor(day.count, tag) }} 
                            data-tooltip={\`\${day.date}: \${day.count} 次 (#\${tag})\`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}`;
tsx = tsx.replace(singleWeekOld, singleWeekNew);

fs.writeFileSync(tsxFile, tsx);

// Update CSS
const cssFile = 'client/src/components/trends/TagTrendsDashboard.css';
let css = fs.readFileSync(cssFile, 'utf8');
css = css.replace('grid-template-columns: 10fr 11fr;', 'grid-template-columns: 8fr 6fr;');
fs.writeFileSync(cssFile, css);

console.log('Update successful');
