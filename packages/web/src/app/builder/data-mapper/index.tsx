import { t } from 'i18next';
import { ExpandIcon, MinusIcon, PanelRightDashedIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type DataMapperBridge = {
  open: boolean;
  renderContent: (container: HTMLElement) => void;
  onClose: () => void;
  mappedCount: number;
};

declare global {
  interface Window {
    __apDataMapperBridge?: DataMapperBridge | null;
  }
}

enum PanelSizeState {
  EXPANDED,
  COLLAPSED,
  DOCKED,
}

type DataMapperPanelProps = {
  parentHeight: number;
  parentWidth: number;
};

const DataMapperPanel = ({
  parentHeight,
  parentWidth,
}: DataMapperPanelProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelSize, setPanelSize] = useState<PanelSizeState>(
    PanelSizeState.DOCKED,
  );
  const [mappedCount, setMappedCount] = useState(0);

  const handleBridgeEvent = useCallback(() => {
    const bridge = window.__apDataMapperBridge;
    if (bridge && bridge.open) {
      setIsOpen(true);
      setMappedCount(bridge.mappedCount);
    } else {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('ap-data-mapper-open', handleBridgeEvent);
    window.addEventListener('ap-data-mapper-close', handleBridgeEvent);
    window.addEventListener('ap-data-mapper-update', handleBridgeEvent);
    return () => {
      window.removeEventListener('ap-data-mapper-open', handleBridgeEvent);
      window.removeEventListener('ap-data-mapper-close', handleBridgeEvent);
      window.removeEventListener('ap-data-mapper-update', handleBridgeEvent);
    };
  }, [handleBridgeEvent]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      const bridge = window.__apDataMapperBridge;
      if (bridge) {
        contentRef.current.innerHTML = '';
        bridge.renderContent(contentRef.current);
      }
    }
  }, [isOpen, panelSize]);

  const buttonClassName = (btnState: PanelSizeState) =>
    cn('', {
      'text-outline': panelSize === btnState,
      'text-outline opacity-50': panelSize !== btnState,
    });

  const panelHeight =
    panelSize === PanelSizeState.COLLAPSED
      ? 0
      : panelSize === PanelSizeState.DOCKED
      ? 450
      : parentHeight - 100;

  const panelWidth =
    panelSize !== PanelSizeState.EXPANDED ? 450 : parentWidth - 40;

  return (
    <div
      className={cn(
        'absolute bottom-0 mr-5 mb-5 right-0 z-50 transition-all border border-solid border-outline overflow-x-hidden bg-background shadow-lg rounded-md',
        {
          'opacity-0 pointer-events-none': !isOpen,
        },
      )}
    >
      <div className="text-lg items-center px-3 py-2 flex gap-2">
        {t('Data Mapper')}
        {mappedCount > 0 && (
          <span className="text-xs font-medium text-success-600 bg-success-50 rounded px-1.5 py-0.5">
            {mappedCount} {t('mapped')}
          </span>
        )}
        <div className="grow"></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className={buttonClassName(PanelSizeState.EXPANDED)}
              onClick={() => setPanelSize(PanelSizeState.EXPANDED)}
              variant="basic"
            >
              <ExpandIcon className="size-5"></ExpandIcon>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('Expand')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className={buttonClassName(PanelSizeState.DOCKED)}
              onClick={() => setPanelSize(PanelSizeState.DOCKED)}
              variant="basic"
            >
              <PanelRightDashedIcon className="size-5"></PanelRightDashedIcon>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('Dock')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className={buttonClassName(PanelSizeState.COLLAPSED)}
              onClick={() => {
                if (panelSize === PanelSizeState.COLLAPSED) {
                  setPanelSize(PanelSizeState.DOCKED);
                } else {
                  setPanelSize(PanelSizeState.COLLAPSED);
                }
              }}
              variant="basic"
            >
              <MinusIcon className="size-5"></MinusIcon>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('Minimize')}</TooltipContent>
        </Tooltip>
      </div>
      <div
        style={{
          height: `${panelHeight}px`,
          width: `${panelWidth}px`,
        }}
        className="transition-all overflow-hidden"
      >
        <div
          ref={contentRef}
          data-ap-data-mapper-content=""
          className="h-full w-full flex flex-col"
        ></div>
      </div>
    </div>
  );
};

DataMapperPanel.displayName = 'DataMapperPanel';
export { DataMapperPanel };
