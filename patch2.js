const fs = require('fs');
const tsxFile = 'client/src/components/trends/TagTrendsDashboard.tsx';
let tsx = fs.readFileSync(tsxFile, 'utf8');

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

tsx = tsx.replace(singleWeekOld, singleWeekNew);
fs.writeFileSync(tsxFile, tsx);
console.log('Fixed Top3 view');
