import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';

interface ReportWindowProps {
  win: UIWindow;
}

export const ReportWindow: React.FC<ReportWindowProps> = ({ win }) => {
  const { closeWindow } = useWindowManager();
  const reportData = win.data;

  return (
    <MdiWindowFrame
      win={win}
      title={win.title}
      onClose={() => closeWindow(win.id)}
    >
      <ReportContainer
        title={reportData.title}
        subtitle={reportData.subtitle}
        initiator={reportData.initiator}
        ReportContent={reportData.ReportContent}
        onExportExcel={reportData.onExportExcel}
        defaultParams={reportData.defaultParams}
        config={reportData.config}
        isWindow={true}
      />
    </MdiWindowFrame>
  );
};
