const fs = require('fs');
const tsxFile = 'client/src/components/trends/TagTrendsDashboard.tsx';
let tsx = fs.readFileSync(tsxFile, 'utf8');

// Replace the single week view
const singleWeekOld = `            ) : timeRange === 'current-week' ? (
              <div className="flex flex-col gap-4">
                <div className="heatmap-single-week">
                  <div className="heatmap-single-week-header">
                    <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
                  </div>
                  <div className="heatmap-single-week-row">
                    {heatmapGridData[0]?.map((day) => (
                      <div 
                        key={day.id} 
                        className="heatmap-cell" 
                        style={{ backgroundColor: getHeatmapColor(day.count) }} 
                        data-tooltip={\`\${day.date}: \${day.count} 次\`}
                      />
                    ))}
                  </div>
                </div>
                
                {/* 增加 Top 2/3 热力图补充单周模式下的空白 */}
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
                })}
              </div>
            ) : (`;

const singleWeekNew = `            ) : timeRange === 'current-week' ? (
              <div className="flex flex-col gap-4">
                <div className="heatmap-single-week">
                  <div className="heatmap-single-week-header">
                    <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
                  </div>
                  <div className="heatmap-single-week-row">
                    {heatmapGridData[0]?.map((day) => (
                      <div 
                        key={day.id} 
                        className="heatmap-cell" 
                        style={{ backgroundColor: getHeatmapColor(day.count) }} 
                        data-tooltip={\`\${day.date}: \${day.count} 次\`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="text-xs mt-2 mb-1 font-bold" style={{color: 'var(--text-secondary)'}}>Top 3 标签</div>
                {allTags.slice(0, 3).map((tag, i) => {
                  const tagData = heatmapGridData[0]?.map(day => {
                    const count = dailyData[day.date]?.[tag] || 0;
                    return { ...day, count };
                  });
                  return (
                    <div className="heatmap-single-week" key={tag}>
                      <div className="heatmap-single-week-header" style={{opacity: 0.8}}>
                        <span style={{width: 'auto', minWidth: '40px', paddingRight: '8px', textAlign: 'left', fontWeight: 'bold', color: COLOR_PALETTE[i % COLOR_PALETTE.length]}}>#{tag}</span>
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
                })}
              </div>
            ) : (`;

tsx = tsx.replace(singleWeekOld, singleWeekNew);
fs.writeFileSync(tsxFile, tsx);

const cssFile = 'client/src/components/trends/TagTrendsDashboard.css';
let css = fs.readFileSync(cssFile, 'utf8');
css = css.replace('grid-template-columns: 10fr 11fr;', 'grid-template-columns: 8fr 6fr;');
fs.writeFileSync(cssFile, css);

console.log('Update successful');
